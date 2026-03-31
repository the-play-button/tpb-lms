/**
 * Parse media URL to determine content source
 */

/**
 * Parse media URL to determine content source
 * @param {Object} media - Media object from lms_class
 * @returns {Object} - { type, url, canFetch }
 */
export const parseMediaUrl = media => {
    if (!media || !media.url) {
        return { type: null, url: null, canFetch: false };
    }

    const url = media.url;
    const type = media.type || 'UNKNOWN';

    if (url.includes('raw.githubusercontent.com')) {
        return { type: 'GITHUB_RAW', url, canFetch: true, source: 'github' };
    }

    if (url.includes('cloudflarestream.com')) {
        return { type: 'VIDEO', url, canFetch: false, source: 'cloudflare' };
    }

    if (url.includes('tally.so')) {
        return { type: 'QUIZ', url, canFetch: false, source: 'tally' };
    }

    if (type === 'DOCUMENT') {
        return { type: 'DOCUMENT', url, canFetch: true, source: 'external' };
    }

    return { type, url, canFetch: false, source: 'unknown' };
};
