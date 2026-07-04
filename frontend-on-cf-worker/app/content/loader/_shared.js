/**
 * Shared content loading primitives - cache, auth, GitHub proxy, i18n URL building
 */

import { API_BASE } from '../../api.js';
import { log } from '../../log.js';

let authToken = null;

export const contentCache = new Map();
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export { log };

/**
 * Get auth token from frontend Worker (same pattern as api.js)
 */
export const getAuthToken = async () => {
    if (authToken) return authToken;

    const response = await fetch('/__auth/token');
    if (!response.ok) throw new Error('Failed to get auth token');

    const data = await response.json();
    authToken = data.token;
    return authToken;
};

/**
 * Check if URL is a GitHub URL (needs proxy for private repos)
 */
export const isGitHubUrl = url => {
    return url.includes('github.com') || url.includes('raw.githubusercontent.com');
};

/**
 * Build proxy URL for GitHub content
 */
export const buildProxyUrl = originalUrl => {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${API_BASE}/content/github?url=${encodedUrl}`;
};

/**
 * Strip YAML frontmatter from markdown content
 */
export const stripFrontmatter = markdown => {
    const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
    if (match) {
        return markdown.slice(match[0].length);
    }
    return markdown;
};

/**
 * Clean up markdown content for LMS display
 */
export const cleanMarkdownForLms = markdown => {
    let cleaned = markdown;

    cleaned = cleaned.replace(/##\s*Vid[eé]o\s*\n+https?:\/\/[^\s]*cloudflarestream\.com[^\s]*/gi, '');

    cleaned = cleaned.replace(/https?:\/\/(?:customer-[\w]+\.)?cloudflarestream\.com\/[\w]+\/iframe\s*/g, '');
    cleaned = cleaned.replace(/https?:\/\/iframe\.cloudflarestream\.com\/[\w]+[^\s]*/g, '');

    cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\.md\)/g, '');
    cleaned = cleaned.replace(/\s*\|\s*\|\s*/g, '');
    cleaned = cleaned.replace(/^\s*\|\s*$/gm, '');

    cleaned = cleaned.replace(/---\s*\n+---/g, '---');

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
};

/**
 * Build localized URL for i18n content.
 */
export const buildLocalizedUrl = (originalUrl, lang) => {
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
};

/**
 * Fetch content directly (no i18n fallback).
 */
export const fetchContentDirect = async url => {
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
};

/**
 * Try to fetch content with i18n fallback.
 * Order: current lang -> en -> original URL
 */
/** Try-or-null helper : returns content on success, null on miss + logs the
 *  intended fallback step. Replaces silent-log catch pattern with explicit
 *  null discriminator per § ALWAYS FAIL HARD (= caller cascades on null). */
const tryFetchOrNull = async (localizedUrl, missMessage) => {
    try {
        return await fetchContentDirect(localizedUrl);
    } catch (e) {
        log.debug(missMessage, { error: e?.message ?? String(e) });
        return null;
    }
};

export const fetchContentWithI18nFallback = async url => {
    const currentLang = window.i18n?.getLanguage?.() || 'fr';

    const localizedUrl = buildLocalizedUrl(url, currentLang);
    const localizedContent = await tryFetchOrNull(
        localizedUrl,
        `[content] ${currentLang} not found, trying fallback...`,
    );
    if (localizedContent !== null) return { content: localizedContent, lang: currentLang, url: localizedUrl };

    if (currentLang !== 'en') {
        const enUrl = buildLocalizedUrl(url, 'en');
        const enContent = await tryFetchOrNull(enUrl, `[content] en not found, trying original...`);
        if (enContent !== null) return { content: enContent, lang: 'en', url: enUrl };
    }

    const content = await fetchContentDirect(url);
    return { content, lang: 'source', url };
};

// ============================================
// ============================================

/**
 * Check if media references cloud content (BYOC)
 */
export const isCloudRef = media => {
    return media?.source === 'cloud' && media?.content_ref_id;
};

/**
 * Build API URL for cloud content
 */
export const buildCloudContentUrl = (contentRefId, lang) => {
    let url = `${API_BASE}/content/cloud?ref_id=${contentRefId}`;
    if (lang) url += `&lang=${lang}`;
    return url;
};

/**
 * Build API URL for cloud pitch file
 */
export const buildCloudPitchUrl = contentRefId => {
    return `${API_BASE}/content/cloud?usage=pitch&ref_id=${contentRefId}`;
};

/**
 * Fetch cloud content directly (no i18n fallback).
 */
export const fetchCloudContentDirect = async (contentRefId, lang) => {
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
};

/**
 * Resolve a relative path against a base URL
 */
export const resolvePath = (baseDir, path) => {
    if (path.startsWith('./')) {
        path = path.substring(2);
    }

    const parts = baseDir.split('/').filter(p => p);
    const pathParts = path.split('/');

    for (const part of pathParts) {
        if (part === '..') {
            parts.pop();
        } else if (part !== '.') {
            parts.push(part);
        }
    }

    const protocol = baseDir.match(/^(https?:\/\/)/)?.[1] || '';
    if (protocol) {
        return protocol + parts.join('/');
    }

    return '/' + parts.join('/');
};
