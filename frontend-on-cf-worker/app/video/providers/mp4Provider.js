/**
 * Native mp4 provider — plain video URLs rendered in a <video> element, tracked via
 * native play/pause/ended/timeupdate events.
 */
import { log } from '../../log.js';
import { getSubtitleTracks } from '../../course/renderer.functions/_mediaHelpers.js';

const RESUME_THRESHOLD = 5;

const speedControl = () => `
    <div class="video-controls" style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem; gap: 0.5rem;">
        <button class="speed-btn" data-testid="video-speed-btn" onclick="window.cycleSpeed()"
                style="padding: 0.5rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
            <span id="speed-display">1x</span> ⚡
        </button>
    </div>
`;

const VIDEO_HOST_HINTS = ['youtube.com', 'youtu.be', 'loom.com', 'cloudflarestream.com'];

export const mp4Provider = {
    id: 'mp4',

    match(media) {
        const url = media?.url || media?.video_url || null;
        if (!url) return null;
        // Only claim plain video urls the dedicated providers didn't match.
        if (VIDEO_HOST_HINTS.some((h) => url.includes(h))) return null;
        if ((media?.type || '').toUpperCase() !== 'VIDEO') return null;
        return { providerId: 'mp4', url };
    },

    renderEmbed({ parsed, stepIndex, courseId, classId, videoDuration, cls }) {
        const subtitles = getSubtitleTracks(cls);
        const currentLang = window.i18n?.getLanguage?.() || 'fr';
        return `
            ${speedControl()}
            <div class="video-container">
                <video controls preload="metadata"
                    style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: #000;"
                    id="video-player-${stepIndex}" data-provider="mp4"
                    data-video-url="${parsed.url}" data-video-duration="${videoDuration}"
                    data-course-id="${courseId}" data-class-id="${classId}">
                    <source src="${parsed.url}" type="video/mp4">
                    ${subtitles.map(({ url, lang, label } = {}) => `
                        <track kind="subtitles" src="${url}" srclang="${lang}"
                               label="${label}" ${lang === currentLang ? 'default' : ''}>
                    `).join('')}
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    },

    initTracking(videoElement, { onEvent, onPing, videoDuration, resumePosition }) {
        let isPlaying = false;
        let lastPingBoundary = -10;

        if (resumePosition && resumePosition >= RESUME_THRESHOLD) {
            videoElement.currentTime = resumePosition;
            lastPingBoundary = Math.floor(resumePosition / 10) * 10 - 10;
        }

        const onPlay = async () => { isPlaying = true; await onEvent('VIDEO_PLAY', Math.floor(videoElement.currentTime || 0), videoDuration); };
        const onPause = () => { isPlaying = false; };
        const onEnded = async () => { isPlaying = false; await onEvent('VIDEO_COMPLETE', videoDuration, videoDuration); };
        const onTime = async () => {
            if (!isPlaying) return;
            const t = Math.floor(videoElement.currentTime || 0);
            const boundary = Math.floor(t / 10) * 10;
            if (boundary !== lastPingBoundary && boundary >= 10) {
                lastPingBoundary = boundary;
                await onPing(t, videoDuration);
            }
        };

        videoElement.addEventListener('play', onPlay);
        videoElement.addEventListener('pause', onPause);
        videoElement.addEventListener('ended', onEnded);
        videoElement.addEventListener('timeupdate', onTime);
        log.info('video', 'Native mp4 tracking setup complete');

        return {
            destroy() {
                videoElement.removeEventListener('play', onPlay);
                videoElement.removeEventListener('pause', onPause);
                videoElement.removeEventListener('ended', onEnded);
                videoElement.removeEventListener('timeupdate', onTime);
                isPlaying = false;
            },
        };
    },
};
