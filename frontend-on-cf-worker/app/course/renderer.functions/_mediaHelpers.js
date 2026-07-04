/**
 * Media helpers — extract / classify entries from a class's `media` array.
 * Pure functions, no DOM, no side effects.
 */
import { isCloudRef } from '../../content/loader/index.js';

export const getMediaByType = (cls, type, extraCheck = null) => {
    const media = cls.media || [];
    return media.find(m => m.type === type && (!extraCheck || m[extraCheck]));
};

export const getDocumentMedia = cls => {
    const media = cls.media || [];
    return media.find(m => m.type === 'DOCUMENT' && (m.url || isCloudRef(m)));
};

export const getSubtitleTracks = cls => {
    const media = cls.media || [];
    const subtitles = media.filter(({ type } = {}) => type === 'SUBTITLE' || type === 'CAPTION');

    const langLabels = {
        fr: 'Français',
        en: 'English',
        es: 'Español',
        de: 'Deutsch',
        it: 'Italiano',
        pt: 'Português'
    };

    return subtitles.map(({ url, vtt_url, lang, label } = {}) => ({
        url: url || vtt_url,
        lang: lang || 'en',
        label: label || langLabels[lang] || lang
    })).filter(({ url } = {}) => url);
};

export const getVideoInfo = cls => {
    const videoMedia = getMediaByType(cls, 'VIDEO');
    if (!videoMedia) return { hasVideo: false };

    // media_json entries carry `url`; older/pipeline rows may carry `video_url`.
    const url = videoMedia.url || videoMedia.video_url || null;
    const youtubeId = extractYoutubeId(url);

    return {
        hasVideo: true,
        streamId: videoMedia.stream_id,
        youtubeId,
        // A YouTube url must NOT flow into a native <video src>; only real MP4 urls do.
        videoUrl: youtubeId ? null : (videoMedia.video_url || (videoMedia.stream_id ? null : url)),
        duration: videoMedia.duration_sec || 300
    };
};

/**
 * Extract the 11-char YouTube video id from a watch / youtu.be / embed / shorts url.
 * Returns null for non-YouTube urls.
 */
export const extractYoutubeId = url => {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
};
