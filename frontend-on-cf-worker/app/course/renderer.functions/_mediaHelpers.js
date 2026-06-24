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

    return {
        hasVideo: true,
        streamId: videoMedia.stream_id,
        videoUrl: videoMedia.video_url,
        duration: videoMedia.duration_sec || 300
    };
};
