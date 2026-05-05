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
        .map(url => fetchContent(url).catch(() => null)); // entropy-then-catch-finally-ok: idiomatic .map(url => fetch().catch()) for partial-failure-tolerant Promise.all — async/await wrapper would add an IIFE for zero gain  # entropy-catch-return-default-ok: null signals missing cache entry — intentional fallback for Promise.all

    await Promise.all(promises);
};
