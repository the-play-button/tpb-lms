/**
 * Fetch content from a repository URL or cloud reference
 *
 * Dual-source: supports both GitHub URLs (default) and cloud content refs (BYOC).
 */

import { contentCache, CACHE_TTL_MS, fetchContentDirect, fetchCloudContentDirect, log } from './_shared.js';

const getCachedOrFetch = async (cacheKey, fetcher, errorContext) => {
    const cached = contentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.content;
    }

    try {
        const content = await fetcher();
        contentCache.set(cacheKey, { content, timestamp: Date.now() });
        return content;
    } catch (error) {
        log.error(errorContext, error);
        throw error;
    }
};

/**
 * Fetch content from a repository URL (GitHub path)
 * @param {string} url - Raw URL to fetch (e.g., https://raw.githubusercontent.com/...)
 * @returns {Promise<string>} - Content as string
 */
export const fetchContent = async url => {
    if (!url) throw new Error('URL is required');
    return getCachedOrFetch(url, () => fetchContentDirect(url), 'Content fetch error:');
};

/**
 * Fetch content from a cloud content reference (BYOC)
 * @param {string} contentRefId - Cloud content reference ID
 * @param {string} lang - Optional language code
 * @returns {Promise<string>} - Content as string
 */
export const fetchCloudContent = async (contentRefId, lang) => {
    if (!contentRefId) throw new Error('Content ref ID is required');
    return getCachedOrFetch(
        `cloud:${contentRefId}:${lang || 'source'}`,
        () => fetchCloudContentDirect(contentRefId, lang),
        'Cloud content fetch error:',
    );
};
