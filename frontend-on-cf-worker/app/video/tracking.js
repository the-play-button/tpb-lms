/**
 * Video Tracking
 * 
 * Uses Cloudflare Stream SDK to track video playback.
 * Sends VIDEO_PING every 10s ONLY when video is actually playing.
 */

import { apiPost, generateIdempotencyKey } from '../api.js';
import { refreshSignals } from '../course/loader.js';
import { updateUIWithoutVideoReset } from '../course/renderer.js';
import { log } from '../../utils/log.js';
import { getState } from '../state.js';

// Video tracking state
let streamPlayer = null;
let lastPingPosition = -10;
let isPlaying = false;
let videoCompletedHandled = false;
let videoTrackingInterval = null;

// Resume position threshold (skip if < 5 seconds)
const RESUME_THRESHOLD = 5;

// Playback speed control (GAP-101)
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let currentSpeedIndex = 2; // Default 1x (index 2)

/**
 * Setup native HTML5 video tracking (for external URLs)
 */
function setupNativeVideoTracking(videoElement, videoDuration, courseId, classId, resumePosition) {
    lastPingPosition = -10;
    isPlaying = false;
    videoCompletedHandled = false;
    
    // Resume position
    if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
        videoElement.currentTime = resumePosition;
        lastPingPosition = Math.floor(resumePosition / 10) * 10 - 10;
    }
    
    // Play event
    videoElement.addEventListener('play', async () => {
        console.log('▶️ Video started playing (native)');
        isPlaying = true;
        const currentTime = Math.floor(videoElement.currentTime || 0);
        await sendVideoEvent('VIDEO_PLAY', 'external', currentTime, videoDuration, courseId, classId);
    });
    
    // Pause event
    videoElement.addEventListener('pause', () => {
        console.log('⏸️ Video paused (native)');
        isPlaying = false;
    });
    
    // Ended event
    videoElement.addEventListener('ended', async () => {
        if (videoCompletedHandled) return;
        console.log('🏁 Video ended (native)');
        videoCompletedHandled = true;
        isPlaying = false;
        await sendVideoEvent('VIDEO_COMPLETE', 'external', videoDuration, videoDuration, courseId, classId);
        await refreshSignals(courseId);
        updateUIWithoutVideoReset();
    });
    
    // Periodic ping while playing
    videoTrackingInterval = setInterval(async () => {
        if (!isPlaying) return;
        
        const currentTime = Math.floor(videoElement.currentTime || 0);
        const pingPosition = Math.floor(currentTime / 10) * 10;
        
        if (pingPosition !== lastPingPosition && pingPosition >= 10) {
            await sendVideoEvent('VIDEO_PING', 'external', currentTime, videoDuration, courseId, classId);
            lastPingPosition = pingPosition;
        }
    }, 10000);
    
    log.info('video', 'Native video tracking setup complete');
}

/**
 * Setup video tracking for a step
 * @param {number} stepIndex - The step index
 * @param {number} resumePosition - Optional position to resume from (GAP-102)
 */
export function setupVideoTracking(stepIndex, resumePosition = null) {
    // Stop any existing tracking
    stopVideoTracking();
    
    // Find the video iframe or native video element for this step
    const iframe = document.getElementById(`video-player-${stepIndex}`);
    if (!iframe) {
        log.debug('video', 'No video player found for step', { stepIndex });
        return;
    }
    
    const videoId = iframe.dataset.videoId;
    const videoUrl = iframe.dataset.videoUrl;
    const videoDuration = parseInt(iframe.dataset.videoDuration) || 300;
    const courseId = iframe.dataset.courseId;
    const classId = iframe.dataset.classId;
    
    log.info('video', 'Setting up video tracking', { stepIndex, videoId, videoUrl, videoDuration, resumePosition });
    
    // For external video URLs (native HTML5 video tag)
    if (videoUrl && iframe.tagName === 'VIDEO') {
        setupNativeVideoTracking(iframe, videoDuration, courseId, classId, resumePosition);
        return;
    }
    
    // For Cloudflare Stream (iframe)
    if (typeof Stream === 'undefined') {
        log.error('video', 'Cloudflare Stream SDK not loaded');
        return;
    }
    
    try {
        streamPlayer = Stream(iframe);
        lastPingPosition = -10;
        isPlaying = false;
        
        // GAP-102: Resume from last position after player is ready
        if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
            // Use loadeddata event to know when we can seek
            streamPlayer.addEventListener('loadeddata', () => {
                console.log(`⏩ Resuming video at ${resumePosition}s`);
                streamPlayer.currentTime = resumePosition;
                lastPingPosition = Math.floor(resumePosition / 10) * 10 - 10;
            }, { once: true });
        }
        
        // Listen to play event
        streamPlayer.addEventListener('play', async () => {
            console.log('▶️ Video started playing');
            isPlaying = true;
            const currentTime = Math.floor(streamPlayer.currentTime || 0);
            await sendVideoEvent('VIDEO_PLAY', videoId, currentTime, videoDuration, courseId, classId);
        });
        
        // Listen to pause event
        streamPlayer.addEventListener('pause', async () => {
            console.log('⏸️ Video paused');
            isPlaying = false;
            const currentTime = Math.floor(streamPlayer.currentTime || 0);
            await sendVideoEvent('VIDEO_PAUSE', videoId, currentTime, videoDuration, courseId, classId);
        });
        
        // Listen to ended event
        streamPlayer.addEventListener('ended', async () => {
            console.log('⏹️ Video ended');
            isPlaying = false;
            
            // Send final ping at 100%
            await sendVideoPing(videoId, videoDuration, videoDuration, courseId, classId);
        });
        
        // Listen to timeupdate event - fires frequently during playback
        streamPlayer.addEventListener('timeupdate', async () => {
            if (!isPlaying) return;
            
            const currentTime = Math.floor(streamPlayer.currentTime);
            const duration = Math.floor(streamPlayer.duration) || videoDuration;
            
            // Send ping every 10 seconds of actual video progress
            if (currentTime >= lastPingPosition + 10) {
                lastPingPosition = Math.floor(currentTime / 10) * 10;
                await sendVideoPing(videoId, currentTime, duration, courseId, classId);
            }
        });
        
        console.log('✅ Stream SDK tracking initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize Stream SDK:', error);
    }
}

/**
 * Get resume position for a class from signals (GAP-102)
 * @param {string} classId - The class ID to get position for
 * @returns {number|null} - Position in seconds, or null if none
 */
export function getResumePosition(classId) {
    const signals = getState('signals');
    const videoPositions = signals?.video_positions || {};
    const positionData = videoPositions[classId];
    
    if (positionData && positionData.position >= RESUME_THRESHOLD) {
        return positionData.position;
    }
    return null;
}

/**
 * Send video event to API
 */
async function sendVideoEvent(eventType, videoId, position, duration, courseId, classId) {
    const progress = duration > 0 ? Math.floor((position / duration) * 100) : 0;
    console.log(`📊 ${eventType}: ${position}s / ${duration}s (${progress}%)`);
    
    try {
        // Generate idempotency key for deduplication (GAP-711)
        const idempotencyKey = generateIdempotencyKey(eventType, courseId, classId);
        
        const result = await apiPost('/events', {
            type: eventType,
            course_id: courseId,
            class_id: classId,
            payload: {
                video_id: videoId,
                position_sec: position,
                duration_sec: duration,
                progress_pct: progress
            }
        }, { idempotencyKey });
        
        console.log(`📤 ${eventType} sent:`, result);
        
        // If video completed, update UI to unlock quiz
        if (result.video_completed && !videoCompletedHandled) {
            videoCompletedHandled = true;
            console.log('✅ Video completed! Updating UI to unlock quiz...');
            showToast('Quiz débloqué !', 'success');
            await refreshSignals();
            updateUIWithoutVideoReset();
        }
        
        return result;
        
    } catch (error) {
        console.warn(`Failed to send ${eventType}:`, error.message);
    }
}

/**
 * Send video ping (alias for backward compatibility)
 */
async function sendVideoPing(videoId, position, duration, courseId, classId) {
    return sendVideoEvent('VIDEO_PING', videoId, position, duration, courseId, classId);
}

/**
 * Stop video tracking
 */
export function stopVideoTracking() {
    if (streamPlayer) {
        console.log('⏹️ Stopping video tracking');
        streamPlayer = null;
        lastPingPosition = -10;
        isPlaying = false;
        videoCompletedHandled = false;
    }
    if (videoTrackingInterval) {
        clearInterval(videoTrackingInterval);
        videoTrackingInterval = null;
    }
}

/**
 * Pause video (used when tab is hidden)
 */
export function pauseVideo() {
    if (streamPlayer && isPlaying) {
        console.log('👁️ Tab hidden - pausing video');
        streamPlayer.pause();
    }
}

/**
 * Check if video is currently playing
 */
export function isVideoPlaying() {
    return isPlaying;
}

/**
 * Cycle through playback speeds (GAP-101)
 * 0.5x -> 0.75x -> 1x -> 1.25x -> 1.5x -> 1.75x -> 2x -> 0.5x...
 */
export function cyclePlaybackSpeed() {
    if (!streamPlayer) {
        log.warn('video', 'No active player to change speed');
        return;
    }
    
    currentSpeedIndex = (currentSpeedIndex + 1) % SPEEDS.length;
    const newSpeed = SPEEDS[currentSpeedIndex];
    
    try {
        streamPlayer.playbackRate = newSpeed;
        log.info('video', 'Playback speed changed', { speed: newSpeed });
        
        // Show toast notification
        if (typeof showToast === 'function') {
            showToast(`Vitesse: ${newSpeed}x`, 'info');
        }
        
        // Update button display if exists
        const speedDisplay = document.getElementById('speed-display');
        if (speedDisplay) {
            speedDisplay.textContent = `${newSpeed}x`;
        }
    } catch (error) {
        log.error('video', 'Failed to change playback speed', { error: error.message });
    }
}

/**
 * Set specific playback speed
 * @param {number} speed - Playback speed (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2)
 */
export function setPlaybackSpeed(speed) {
    if (!streamPlayer) {
        log.warn('video', 'No active player to set speed');
        return;
    }
    
    const speedIndex = SPEEDS.indexOf(speed);
    if (speedIndex === -1) {
        log.warn('video', 'Invalid playback speed', { speed });
        return;
    }
    
    currentSpeedIndex = speedIndex;
    streamPlayer.playbackRate = speed;
    
    log.info('video', 'Playback speed set', { speed });
    
    // Update button display if exists
    const speedDisplay = document.getElementById('speed-display');
    if (speedDisplay) {
        speedDisplay.textContent = `${speed}x`;
    }
}

/**
 * Get current playback speed
 * @returns {number} Current speed
 */
export function getCurrentSpeed() {
    return SPEEDS[currentSpeedIndex];
}

/**
 * Get available playback speeds
 * @returns {number[]} Array of available speeds
 */
export function getAvailableSpeeds() {
    return [...SPEEDS];
}
