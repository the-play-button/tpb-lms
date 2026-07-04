/**
 * YouTube provider — unlisted/public YouTube embeds. Tracking via the YouTube
 * IFrame API (event-driven onStateChange → play/pause/ended).
 */
import { log } from '../../log.js';

const EMBED_BASE = 'https://www.youtube.com/embed';
const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';

let ytScriptInjected = false;

const extractYoutubeId = (url) => {
    if (!url) return null;
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
};

const loadYouTubeApi = () => {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (!ytScriptInjected) {
        ytScriptInjected = true;
        const tag = document.createElement('script');
        tag.src = IFRAME_API_URL;
        document.head.appendChild(tag);
    }
    return window.__tpbYouTubeApiReady ?? Promise.resolve(window.YT);
};

export const youtubeProvider = {
    id: 'youtube',

    match(media) {
        const url = media?.url || media?.video_url || null;
        const videoId = extractYoutubeId(url);
        return videoId ? { providerId: 'youtube', videoId } : null;
    },

    renderEmbed({ parsed, stepIndex, courseId, classId, videoDuration }) {
        const params = new URLSearchParams({ rel: '0', modestbranding: '1', enablejsapi: '1' });
        return `
            <div class="video-container">
                <iframe src="${EMBED_BASE}/${parsed.videoId}?${params.toString()}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-provider="youtube" data-youtube-id="${parsed.videoId}"
                    data-video-duration="${videoDuration}"
                    data-course-id="${courseId}" data-class-id="${classId}">
                </iframe>
            </div>
        `;
    },

    initTracking(iframe, { onEvent, onPing, videoDuration }) {
        let player = null;
        let isPlaying = false;
        (async () => {
            try {
                const YT = await loadYouTubeApi();
                player = new YT.Player(iframe, {
                    events: {
                        onStateChange: async (e) => {
                            const t = Math.floor(player.getCurrentTime?.() || 0);
                            const dur = Math.floor(player.getDuration?.() || videoDuration);
                            if (e.data === YT.PlayerState.PLAYING) {
                                isPlaying = true;
                                await onEvent('VIDEO_PLAY', t, dur);
                            } else if (e.data === YT.PlayerState.PAUSED) {
                                isPlaying = false;
                                await onEvent('VIDEO_PAUSE', t, dur);
                                await onPing(t, dur);
                            } else if (e.data === YT.PlayerState.ENDED) {
                                isPlaying = false;
                                await onPing(dur, dur);
                            }
                        },
                    },
                });
                log.debug('YouTube IFrame API tracking initialized');
            } catch (error) {
                // Best-effort: playback still works even if tracking fails to attach.
                log.error('video', 'YouTube IFrame API tracking failed', error);
            }
        })();
        return {
            destroy() {
                try { player?.destroy?.(); } catch { /* already gone */ }
                player = null;
                isPlaying = false;
            },
        };
    },
};
