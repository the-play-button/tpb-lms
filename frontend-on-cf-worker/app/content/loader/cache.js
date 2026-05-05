/**
 * Content cache management
 */

import { log } from '../../log.js';
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
        .map(url => fetchContent(url).catch(err => {
            // Log preload failure so operators can spot broken content URLs ;
            // null = "preload skipped, will re-fetch on demand" (non-blocking).
            log.warn(`preload fetch failed for ${url}, will re-fetch on demand`, err);
            return null;
        })); // entropy-then-catch-finally-ok: idiomatic .map(url => fetch().catch()) for partial-failure-tolerant Promise.all — error logged before fallback (not blind)  # entropy-catch-return-default-ok: null signals missing cache entry — error logged, intentional fallback for Promise.all

    await Promise.all(promises);
};
