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
        }));

    await Promise.all(promises);
};
