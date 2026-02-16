/**
 * Parse media URL to determine content source
 */

/**
 * Parse media URL to determine content source
 * @param {Object} media - Media object from lms_class
 * @returns {Object} - { type, url, canFetch }
 */
export function parseMediaUrl(media) {
    if (!media || !media.url) {
        return { type: null, url: null, canFetch: false };
    }

    const url = media.url;
    const type = media.type || 'UNKNOWN';

    // GitHub raw URLs - can fetch directly
    if (url.includes('raw.githubusercontent.com')) {
        return { type: 'GITHUB_RAW', url, canFetch: true, source: 'github' };
    }

    // Cloudflare Stream
    if (url.includes('cloudflarestream.com')) {
        return { type: 'VIDEO', url, canFetch: false, source: 'cloudflare' };
    }

    // Tally forms
    if (url.includes('tally.so')) {
        return { type: 'QUIZ', url, canFetch: false, source: 'tally' };
    }

    // Generic document URL
    if (type === 'DOCUMENT') {
        return { type: 'DOCUMENT', url, canFetch: true, source: 'external' };
    }

    return { type, url, canFetch: false, source: 'unknown' };
}
