/**
 * Fetch markdown content with i18n fallback and processing
 */

import { stripFrontmatter, cleanMarkdownForLms, fetchContentWithI18nFallback } from './_shared.js';
import { fetchContent } from './fetchContent.js';
import { resolveRelativeUrls } from './resolveRelativeUrls.js';

/**
 * Fetch markdown content and resolve relative URLs.
 * Automatically tries i18n/{lang}/ path with fallback to en, then source.
 *
 * @param {string} url - Raw URL to fetch
 * @param {Object} options - Options
 * @param {boolean} options.resolveImages - Resolve relative image URLs (default: true)
 * @param {boolean} options.useI18n - Use i18n fallback (default: true)
 * @returns {Promise<string>} - Markdown content with resolved URLs
 */
export const fetchMarkdown = async (url, options = {}) => {
    const {
        resolveImages = true,
        stripYamlFrontmatter = true,
        cleanForLms = true,
        useI18n = true
    } = options;

    let markdown;
    let actualUrl = url;

    if (useI18n) {
        const result = await fetchContentWithI18nFallback(url);
        markdown = result.content;
        actualUrl = result.url;
    } else {
        markdown = await fetchContent(url);
    }

    if (stripYamlFrontmatter) {
        markdown = stripFrontmatter(markdown);
    }

    if (cleanForLms) {
        markdown = cleanMarkdownForLms(markdown);
    }

    if (resolveImages) {
        markdown = resolveRelativeUrls(markdown, actualUrl);
    }

    return markdown;
};
