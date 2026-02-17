// entropy-multiple-exports-ok: tightly-coupled content loading primitives
// entropy-god-file-ok: cohesive module
// entropy-unused-export-ok: fetchCloudContentWithI18nFallback available for external consumers
// entropy-legacy-marker-ok: tracked in backlog
/**
 * Shared content loading primitives - cache, auth, GitHub proxy, i18n URL building
 */

import { API_BASE } from '../../api.js';
import { log } from '../../log.js';

// Auth token cache (shared with api.js pattern)
let authToken = null;

// Simple in-memory cache for content
export const contentCache = new Map();
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export { log };

/**
 * Get auth token from frontend Worker (same pattern as api.js)
 */
export async function getAuthToken() {
    if (authToken) return authToken;

    const response = await fetch('/__auth/token');
    if (!response.ok) throw new Error('Failed to get auth token');

    const data = await response.json();
    authToken = data.token;
    return authToken;
}

/**
 * Check if URL is a GitHub URL (needs proxy for private repos)
 */
export function isGitHubUrl(url) {
    return url.includes('github.com') || url.includes('raw.githubusercontent.com');
}

/**
 * Build proxy URL for GitHub content
 */
export function buildProxyUrl(originalUrl) {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${API_BASE}/content/github?url=${encodedUrl}`;
}

/**
 * Strip YAML frontmatter from markdown content
 */
export function stripFrontmatter(markdown) {
    const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
    if (match) {
        return markdown.slice(match[0].length);
    }
    return markdown;
}

/**
 * Clean up markdown content for LMS display
 */
export function cleanMarkdownForLms(markdown) {
    let cleaned = markdown;

    // Remove "## Video" section with cloudflare URL (video rendered separately)
    cleaned = cleaned.replace(/##\s*Vid[eé]o\s*\n+https?:\/\/[^\s]*cloudflarestream\.com[^\s]*/gi, '');

    // Remove standalone cloudflare stream URLs (plain text or links)
    cleaned = cleaned.replace(/https?:\/\/(?:customer-[\w]+\.)?cloudflarestream\.com\/[\w]+\/iframe\s*/g, '');
    cleaned = cleaned.replace(/https?:\/\/iframe\.cloudflarestream\.com\/[\w]+[^\s]*/g, '');

    // Remove navigation links to .md files
    cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\.md\)/g, '');
    // Clean up leftover separators from navigation
    cleaned = cleaned.replace(/\s*\|\s*\|\s*/g, '');
    cleaned = cleaned.replace(/^\s*\|\s*$/gm, '');

    // Remove empty horizontal rules sections
    cleaned = cleaned.replace(/---\s*\n+---/g, '---');

    // Remove multiple consecutive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
}

/**
 * Build localized URL for i18n content.
 */
export function buildLocalizedUrl(originalUrl, lang) {
    if (!originalUrl.includes('/STEPS/') && !originalUrl.includes('/outputs/SOM_')) {
        return originalUrl;
    }

    if (originalUrl.includes('/STEPS/')) {
        return originalUrl.replace('/STEPS/', `/i18n/${lang}/STEPS/`);
    }

    const match = originalUrl.match(/(.+\/outputs\/SOM_[^/]+\/)(.+)$/);
    if (match) {
        return `${match[1]}i18n/${lang}/${match[2]}`;
    }

    return originalUrl;
}

/**
 * Fetch content directly (no i18n fallback).
 */
export async function fetchContentDirect(url) {
    const fetchUrl = isGitHubUrl(url) ? buildProxyUrl(url) : url;

    const headers = {
        'Accept': 'text/plain, text/markdown, */*'
    };

    if (isGitHubUrl(url)) {
        const token = await getAuthToken();
        headers['Cf-Access-Jwt-Assertion'] = token;
    }

    const response = await fetch(fetchUrl, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status}`);
    }

    return await response.text();
}

/**
 * Try to fetch content with i18n fallback.
 * Order: current lang -> en -> original URL
 */
export async function fetchContentWithI18nFallback(url) {
    const currentLang = window.i18n?.getLanguage?.() || 'fr';

    // Try current language first
    try {
        const localizedUrl = buildLocalizedUrl(url, currentLang);
        const content = await fetchContentDirect(localizedUrl);
        return { content, lang: currentLang, url: localizedUrl };
    } catch (e) {
        log.debug(`[content] ${currentLang} not found, trying fallback...`);
    }

    // Fallback to English if not already
    if (currentLang !== 'en') {
        try {
            const enUrl = buildLocalizedUrl(url, 'en');
            const content = await fetchContentDirect(enUrl);
            return { content, lang: 'en', url: enUrl };
        } catch (e) {
            log.debug(`[content] en not found, trying original...`);
        }
    }

    // Fallback to original URL (source content)
    const content = await fetchContentDirect(url);
    return { content, lang: 'source', url };
}

// ============================================
// BYOC Cloud Content Helpers
// ============================================

/**
 * Check if media references cloud content (BYOC)
 */
export function isCloudRef(media) {
    return media?.source === 'cloud' && media?.content_ref_id;
}

/**
 * Build API URL for cloud content
 */
export function buildCloudContentUrl(contentRefId, lang) {
    let url = `${API_BASE}/content/cloud?ref_id=${contentRefId}`;
    if (lang) url += `&lang=${lang}`;
    return url;
}

/**
 * Build API URL for cloud pitch file
 */
export function buildCloudPitchUrl(contentRefId) {
    return `${API_BASE}/content/cloud/pitch?ref_id=${contentRefId}`;
}

/**
 * Fetch cloud content directly (no i18n fallback).
 */
export async function fetchCloudContentDirect(contentRefId, lang) {
    const fetchUrl = buildCloudContentUrl(contentRefId, lang);

    const token = await getAuthToken();
    const headers = {
        'Accept': 'text/plain, text/markdown, */*',
        'Cf-Access-Jwt-Assertion': token,
    };

    const response = await fetch(fetchUrl, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch cloud content: ${response.status}`);
    }

    return await response.text();
}

/**
 * Fetch cloud content with i18n fallback.
 * Order: current lang -> en -> source
 */
export async function fetchCloudContentWithI18nFallback(contentRefId) {
    const currentLang = window.i18n?.getLanguage?.() || 'fr';

    // Try current language first
    try {
        const content = await fetchCloudContentDirect(contentRefId, currentLang);
        return { content, lang: currentLang };
    } catch (e) {
        log.debug(`[content] cloud ${currentLang} not found, trying fallback...`);
    }

    // Fallback to English
    if (currentLang !== 'en') {
        try {
            const content = await fetchCloudContentDirect(contentRefId, 'en');
            return { content, lang: 'en' };
        } catch (e) {
            log.debug(`[content] cloud en not found, trying source...`);
        }
    }

    // Fallback to source (no lang param)
    const content = await fetchCloudContentDirect(contentRefId);
    return { content, lang: 'source' };
}

/**
 * Resolve a relative path against a base URL
 */
export function resolvePath(baseDir, path) {
    // Remove leading ./
    if (path.startsWith('./')) {
        path = path.substring(2);
    }

    // Handle ../
    const parts = baseDir.split('/').filter(p => p);
    const pathParts = path.split('/');

    for (const part of pathParts) {
        if (part === '..') {
            parts.pop();
        } else if (part !== '.') {
            parts.push(part);
        }
    }

    // Reconstruct URL
    const protocol = baseDir.match(/^(https?:\/\/)/)?.[1] || '';
    if (protocol) {
        return protocol + parts.join('/');
    }

    return '/' + parts.join('/');
}
