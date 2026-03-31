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
export const resolveRelativeUrls = (markdown, baseUrl) => {
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

    markdown = markdown.replace(
        /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
        (match, alt, path) => {
            const resolvedPath = resolvePath(baseDir, path);
            return `![${alt}](${resolvedPath})`;
        }
    );

    markdown = markdown.replace(
        /\[([^\]]*)\]\((?!https?:\/\/)(?!#)([^)]+\.md)\)/g,
        (match, text, path) => {
            return `[${text}](${path})`;
        }
    );

    return markdown;
};
