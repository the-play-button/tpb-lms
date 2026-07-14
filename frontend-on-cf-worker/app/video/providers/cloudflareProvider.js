/**
 * Cloudflare Stream provider — BYO-stream lessons (iframe.cloudflarestream.com).
 * Tracking via the Stream player SDK (global `Stream`).
 */
import { log } from '../../log.js';
import { trackingState, RESUME_THRESHOLD } from '../tracking/_shared.js';

const IFRAME_BASE = 'https://iframe.cloudflarestream.com';

const speedControl = () => `
    <div class="video-controls" style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem; gap: 0.5rem;">
        <button class="speed-btn" data-testid="video-speed-btn" onclick="window.cycleSpeed()"
                style="padding: 0.5rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
            <span id="speed-display">1x</span> ⚡
        </button>
    </div>
`;

export const cloudflareProvider = {
    id: 'cloudflare',

    match(media) {
        const url = media?.url || media?.video_url || null;
        if (media?.stream_id) return { providerId: 'cloudflare', videoId: media.stream_id };
        if (url && url.includes('cloudflarestream.com')) return { providerId: 'cloudflare', videoId: url };
        return null;
    },

    renderEmbed({ parsed, stepIndex, courseId, classId, videoDuration }) {
        const currentLang = window.i18n?.getLanguage?.() || 'fr';
        const params = new URLSearchParams({ preload: 'metadata', defaultTextTrack: currentLang });
        return `
            ${speedControl()}
            <div class="video-container">
                <iframe src="${IFRAME_BASE}/${parsed.videoId}?${params.toString()}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-provider="cloudflare" data-video-id="${parsed.videoId}"
                    data-video-duration="${videoDuration}"
                    data-course-id="${courseId}" data-class-id="${classId}">
                </iframe>
            </div>
        `;
    },

    initTracking(iframe, { onEvent, onPing, videoDuration, resumePosition }) {
        if (typeof Stream === 'undefined') {
            log.error('video', 'Cloudflare Stream SDK not loaded');
            return { destroy() {} };
        }
        let player = null;
        let isPlaying = false;
        let lastPingBoundary = -10;
        try {
            player = Stream(iframe);
            // Expose the player for the (CF-Stream-only) pause + speed controls.
            trackingState.streamPlayer = player;

            if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
                player.addEventListener('loadeddata', () => {
                    player.currentTime = resumePosition;
                    lastPingBoundary = Math.floor(resumePosition / 10) * 10 - 10;
                }, { once: true });
            }

            player.addEventListener('play', async () => {
                isPlaying = true;
                trackingState.isPlaying = true;
                await onEvent('VIDEO_PLAY', Math.floor(player.currentTime || 0), videoDuration);
            });
            player.addEventListener('pause', async () => {
                isPlaying = false;
                trackingState.isPlaying = false;
                await onEvent('VIDEO_PAUSE', Math.floor(player.currentTime || 0), videoDuration);
            });
            player.addEventListener('ended', async () => {
                isPlaying = false;
                await onPing(videoDuration, videoDuration);
            });
            player.addEventListener('timeupdate', async () => {
                if (!isPlaying) return;
                const t = Math.floor(player.currentTime);
                const dur = Math.floor(player.duration) || videoDuration;
                if (t >= lastPingBoundary + 10) {
                    lastPingBoundary = Math.floor(t / 10) * 10;
                    await onPing(t, dur);
                }
            });
            log.debug('Stream SDK tracking initialized');
        } catch (error) {
            // entropy-ts-silent-log-only-catch-ok: best-effort CF Stream progress tracking — if the SDK fails to attach, playback still works, we just skip event recording.
            log.error('Failed to initialize Stream SDK:', error);
        }
        return {
            destroy() {
                try { player = null; } catch { /* noop */ }
                isPlaying = false;
            },
        };
    },
};
