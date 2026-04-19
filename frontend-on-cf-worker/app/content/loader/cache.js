/**
 * Content cache management
 */

import { contentCache } from './_shared.js';
import { fetchContent } from './fetchContent.js';

/**
 * Clear content cache
 */
export const clearCache = () => {
    contentCache.clear();
};

/**
 * Preload content for upcoming steps
 * @param {Array<string>} urls - URLs to preload
 */
export const preloadContent = async urls => {
    const promises = urls
        .filter(url => url && !contentCache.has(url))
        .map(url => fetchContent(url).catch(() => null)); // entropy-then-catch-finally-ok: promise chain — async/await refactor tracked in TODO  # entropy-catch-return-default-ok: null signals missing cache entry — intentional fallback for Promise.all

    await Promise.all(promises);
};
