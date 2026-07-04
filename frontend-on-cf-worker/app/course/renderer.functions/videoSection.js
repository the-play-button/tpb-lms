/**
 * Video section renderer — Cloudflare Stream iframe OR native <video>
 * element (= covers BYO-stream + external video URLs).
 */
import { getSubtitleTracks } from './_mediaHelpers.js';
import { t } from '../../../i18n/index.js';

const CLOUDFLARE_STREAM_IFRAME_BASE = 'https://iframe.cloudflarestream.com';
const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed';

export const renderVideoSection = ctx => {
    const { cls, stepIndex, currentCourse, videoId, videoYoutubeId, videoUrl, videoDuration, quizPassed, hasQuiz } = ctx;

    if (quizPassed && hasQuiz) {
        return `
            <div class="video-locked">
                <div class="locked-icon">🔒</div>
                <p>${t('course.videoLocked')}</p>
            </div>
        `;
    }

    if (!videoId && !videoYoutubeId && !videoUrl) {
        return '';
    }

    // YouTube embed (e.g. private/unlisted channel hosting the classroom videos).
    // enablejsapi=1 lets the YouTube IFrame API drive progress tracking.
    if (videoYoutubeId) {
        const ytParams = new URLSearchParams({ rel: '0', modestbranding: '1', enablejsapi: '1' });
        return `
            <div class="video-container">
                <iframe src="${YOUTUBE_EMBED_BASE}/${videoYoutubeId}?${ytParams.toString()}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-youtube-id="${videoYoutubeId}" data-video-duration="${videoDuration}"
                    data-course-id="${currentCourse}" data-class-id="${cls.id}">
                </iframe>
            </div>
        `;
    }

    const speedControl = `
        <div class="video-controls" style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem; gap: 0.5rem;">
            <button class="speed-btn" data-testid="video-speed-btn" onclick="window.cycleSpeed()"
                    title="Changer la vitesse de lecture (0.5x - 2x)"
                    style="padding: 0.5rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                <span id="speed-display">1x</span> ⚡
            </button>
        </div>
    `;

    if (videoId) {
        const currentLang = window.i18n?.getLanguage?.() || 'fr';
        const streamParams = new URLSearchParams({
            preload: 'metadata',
            defaultTextTrack: currentLang
        });

        return `
            ${speedControl}
            <div class="video-container">
                <iframe src="${CLOUDFLARE_STREAM_IFRAME_BASE}/${videoId}?${streamParams.toString()}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-video-id="${videoId}" data-video-duration="${videoDuration}"
                    data-course-id="${currentCourse}" data-class-id="${cls.id}">
                </iframe>
            </div>
        `;
    }

    if (videoUrl) {
        const subtitles = getSubtitleTracks(cls);
        const currentLang = window.i18n?.getLanguage?.() || 'fr';

        return `
            ${speedControl}
            <div class="video-container">
                <video controls preload="metadata"
                    style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: #000;"
                    id="video-player-${stepIndex}"
                    data-video-url="${videoUrl}" data-video-duration="${videoDuration}"
                    data-course-id="${currentCourse}" data-class-id="${cls.id}">
                    <source src="${videoUrl}" type="video/mp4">
                    ${subtitles.map(({ url, lang, label } = {}) => `
                        <track kind="subtitles" src="${url}" srclang="${lang}"
                               label="${label}" ${lang === currentLang ? 'default' : ''}>
                    `).join('')}
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    }

    return '';
};
