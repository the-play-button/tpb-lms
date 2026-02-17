/**
 * Fetch content from a repository URL or cloud reference
 *
 * Dual-source: supports both GitHub URLs (legacy) and cloud content refs (BYOC).
 */

import { contentCache, CACHE_TTL_MS, isGitHubUrl, buildProxyUrl, isCloudRef, fetchCloudContentDirect, getAuthToken, log } from './_shared.js';

/**
 * Fetch content from a repository URL (legacy GitHub path)
 * @param {string} url - Raw URL to fetch (e.g., https://raw.githubusercontent.com/...)
 * @returns {Promise<string>} - Content as string
 */
export async function fetchContent(url) {
    if (!url) {
        throw new Error('URL is required');
    }

    // Check cache first
    const cached = contentCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.content;
    }

    try {
        // Use proxy for GitHub URLs (private repos need auth)
        const fetchUrl = isGitHubUrl(url) ? buildProxyUrl(url) : url;

        const headers = {
            'Accept': 'text/plain, text/markdown, */*'
        };

        // Add JWT for proxy requests (same auth pattern as api.js)
        if (isGitHubUrl(url)) {
            const token = await getAuthToken();
            headers['Cf-Access-Jwt-Assertion'] = token;
        }

        const response = await fetch(fetchUrl, { headers });

        if (!response.ok) {
            throw new Error(`Failed to fetch content: ${response.status}`);
        }

        const content = await response.text();

        // Cache the result
        contentCache.set(url, {
            content,
            timestamp: Date.now()
        });

        return content;
    } catch (error) {
        log.error('Content fetch error:', error);
        throw error;
    }
}

/**
 * Fetch content from a cloud content reference (BYOC)
 * @param {string} contentRefId - Cloud content reference ID
 * @param {string} lang - Optional language code
 * @returns {Promise<string>} - Content as string
 */
export async function fetchCloudContent(contentRefId, lang) {
    if (!contentRefId) {
        throw new Error('Content ref ID is required');
    }

    const cacheKey = `cloud:${contentRefId}:${lang || 'source'}`;

    // Check cache first
    const cached = contentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.content;
    }

    try {
        const content = await fetchCloudContentDirect(contentRefId, lang);

        // Cache the result
        contentCache.set(cacheKey, {
            content,
            timestamp: Date.now()
        });

        return content;
    } catch (error) {
        log.error('Cloud content fetch error:', error);
        throw error;
    }
}
