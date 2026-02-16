/**
 * Resolve relative URLs in markdown content
 */

import { resolvePath } from './_shared.js';

/**
 * Resolve relative URLs in markdown content
 * @param {string} markdown - Markdown content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {string} - Markdown with resolved URLs
 */
export function resolveRelativeUrls(markdown, baseUrl) {
    // Parse base URL to get directory
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

    // Resolve image URLs: ![alt](./image.png) or ![alt](image.png)
    markdown = markdown.replace(
        /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
        (match, alt, path) => {
            const resolvedPath = resolvePath(baseDir, path);
            return `![${alt}](${resolvedPath})`;
        }
    );

    // Resolve link URLs that are relative markdown files (but not anchors)
    markdown = markdown.replace(
        /\[([^\]]*)\]\((?!https?:\/\/)(?!#)([^)]+\.md)\)/g,
        (match, text, path) => {
            // Don't resolve .md links - they should be handled by navigation
            // Just mark them for potential click handling
            return `[${text}](${path})`;
        }
    );

    return markdown;
}
