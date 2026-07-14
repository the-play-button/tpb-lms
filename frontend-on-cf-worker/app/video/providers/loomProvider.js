/**
 * Loom provider — embeds public Loom share videos (loom.com/embed/<id>) and tracks
 * playback via the `player.js` protocol Loom speaks over postMessage (verified live:
 * the embed emits ready/play/pause/ended/timeupdate). No npm dependency — a thin
 * postMessage handshake. The backend computes completion from the emitted pings.
 */
import { log } from '../../log.js';

const EMBED_BASE = 'https://www.loom.com/embed';
const LOOM_ORIGIN = 'https://www.loom.com';
const PLAYERJS_CONTEXT = 'player.js';
const PLAYERJS_VERSION = '0.0.11';

const extractLoomId = (url) => {
    if (!url) return null;
    const m = String(url).match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]{16,})/);
    return m ? m[1] : null;
};

export const loomProvider = {
    id: 'loom',

    match(media) {
        const url = media?.url || media?.video_url || null;
        const videoId = extractLoomId(url);
        return videoId ? { providerId: 'loom', videoId } : null;
    },

    renderEmbed({ parsed, stepIndex, courseId, classId, videoDuration }) {
        const params = new URLSearchParams({ hide_owner: 'true', hide_share: 'true', hideEmbedTopBar: 'true' });
        return `
            <div class="video-container">
                <iframe src="${EMBED_BASE}/${parsed.videoId}?${params.toString()}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="autoplay; fullscreen; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-provider="loom" data-loom-id="${parsed.videoId}"
                    data-video-duration="${videoDuration}"
                    data-course-id="${courseId}" data-class-id="${classId}">
                </iframe>
            </div>
        `;
    },

    initTracking(iframe, { onEvent, onPing, videoDuration }) {
        let isPlaying = false;
        let lastPingBoundary = -10;
        const listenerId = `tpb-loom-${Math.floor(iframe.dataset.videoDuration || 0)}-${iframe.id}`;

        const post = (method, value) => {
            try {
                iframe.contentWindow?.postMessage(
                    { context: PLAYERJS_CONTEXT, version: PLAYERJS_VERSION, method, value, listener: listenerId },
                    LOOM_ORIGIN,
                );
            } catch (e) {
                // entropy-ts-silent-log-only-catch-ok: best-effort Loom player.js postMessage — a cross-origin frame not ready yet is expected; the player still functions, tracking retries on the next event.
                log.warn('video', 'loom postMessage failed', e);
            }
        };

        const subscribe = () => {
            for (const evt of ['play', 'pause', 'ended', 'timeupdate']) {
                post('addEventListener', evt);
            }
        };

        const handler = async (e) => {
            if (String(e.origin) !== LOOM_ORIGIN) return;
            const d = e.data;
            if (!d || d.context !== PLAYERJS_CONTEXT) return;

            if (d.event === 'ready') { subscribe(); return; }

            const v = d.value || {};
            const dur = Math.floor(v.duration || videoDuration);
            const pos = Math.floor(v.seconds ?? v.currentTime ?? 0);

            if (d.event === 'play') { isPlaying = true; await onEvent('VIDEO_PLAY', pos, dur); }
            else if (d.event === 'pause') { isPlaying = false; await onEvent('VIDEO_PAUSE', pos, dur); await onPing(pos, dur); }
            else if (d.event === 'ended') { isPlaying = false; await onPing(dur, dur); }
            else if (d.event === 'timeupdate') {
                if (!isPlaying) return;
                const boundary = Math.floor(pos / 10) * 10;
                if (boundary !== lastPingBoundary && boundary >= 10) {
                    lastPingBoundary = boundary;
                    await onPing(pos, dur);
                }
            }
        };

        window.addEventListener('message', handler);
        // The iframe may already be ready before our listener attached — nudge it.
        subscribe();
        log.debug('Loom player.js tracking initialized');

        return {
            destroy() {
                window.removeEventListener('message', handler);
                isPlaying = false;
            },
        };
    },
};
