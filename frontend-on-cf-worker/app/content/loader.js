/**
 * Content Loader
 * 
 * Fetches markdown content from repository URLs (GitHub, etc.).
 * Uses backend proxy for private GitHub repos.
 * Used for course intros and CONTENT steps served from Git.
 */

import { API_BASE } from '../api.js';

// Auth token cache (shared with api.js pattern)
let authToken = null;

/**
 * Get auth token from frontend Worker (same pattern as api.js)
 */
async function getAuthToken() {
    if (authToken) return authToken;
    
    const response = await fetch('/__auth/token');
    if (!response.ok) throw new Error('Failed to get auth token');
    
    const data = await response.json();
    authToken = data.token;
    return authToken;
}

// Simple in-memory cache for content
const contentCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Strip YAML frontmatter from markdown content
 * Frontmatter starts with --- and ends with ---
 */
function stripFrontmatter(markdown) {
    const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
    if (match) {
        return markdown.slice(match[0].length);
    }
    return markdown;
}

/**
 * Clean up markdown content for LMS display
 * - Removes video URLs (video is rendered separately from media array)
 * - Removes dead .md navigation links
 * - Removes "Vidéo" headers followed by cloudflare URLs
 */
function cleanMarkdownForLms(markdown) {
    let cleaned = markdown;
    
    // Remove "## Vidéo" section with cloudflare URL (video rendered separately)
    cleaned = cleaned.replace(/##\s*Vidéo\s*\n+https?:\/\/[^\s]*cloudflarestream\.com[^\s]*/gi, '');
    
    // Remove standalone cloudflare stream URLs (plain text or links)
    cleaned = cleaned.replace(/https?:\/\/(?:customer-[\w]+\.)?cloudflarestream\.com\/[\w]+\/iframe\s*/g, '');
    cleaned = cleaned.replace(/https?:\/\/iframe\.cloudflarestream\.com\/[\w]+[^\s]*/g, '');
    
    // Remove navigation links to .md files (e.g., [← Retour](../index.md) | [Suivant →](STEP02.md))
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
 * Check if URL is a GitHub URL (needs proxy for private repos)
 */
function isGitHubUrl(url) {
    return url.includes('github.com') || url.includes('raw.githubusercontent.com');
}

/**
 * Build proxy URL for GitHub content
 */
function buildProxyUrl(originalUrl) {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${API_BASE}/content/github?url=${encodedUrl}`;
}

/**
 * Build localized URL for i18n content.
 * Transforms: /.../STEPS/STEP01.md -> /.../i18n/{lang}/STEPS/STEP01.md
 * 
 * @param {string} originalUrl - Original content URL
 * @param {string} lang - Target language code
 * @returns {string} - Localized URL
 */
function buildLocalizedUrl(originalUrl, lang) {
    // Only transform URLs that contain /STEPS/ or /outputs/SOM_
    if (!originalUrl.includes('/STEPS/') && !originalUrl.includes('/outputs/SOM_')) {
        return originalUrl;
    }
    
    // For URLs with /outputs/SOM_xxx/STEPS/... pattern
    // Insert i18n/{lang}/ before STEPS/
    if (originalUrl.includes('/STEPS/')) {
        return originalUrl.replace('/STEPS/', `/i18n/${lang}/STEPS/`);
    }
    
    // For main SOM file: /outputs/SOM_xxx/SOM_xxx.md
    // Insert i18n/{lang}/ before SOM_ filename
    const match = originalUrl.match(/(.+\/outputs\/SOM_[^/]+\/)(.+)$/);
    if (match) {
        return `${match[1]}i18n/${lang}/${match[2]}`;
    }
    
    return originalUrl;
}

/**
 * Try to fetch content with i18n fallback.
 * Order: current lang -> en -> original URL
 * 
 * @param {string} url - Original content URL
 * @returns {Promise<{content: string, lang: string, url: string}>}
 */
async function fetchContentWithI18nFallback(url) {
    const currentLang = window.i18n?.getLanguage?.() || 'fr';
    
    // Try current language first
    try {
        const localizedUrl = buildLocalizedUrl(url, currentLang);
        const content = await fetchContentDirect(localizedUrl);
        return { content, lang: currentLang, url: localizedUrl };
    } catch (e) {
        console.log(`[content] ${currentLang} not found, trying fallback...`);
    }
    
    // Fallback to English if not already
    if (currentLang !== 'en') {
        try {
            const enUrl = buildLocalizedUrl(url, 'en');
            const content = await fetchContentDirect(enUrl);
            return { content, lang: 'en', url: enUrl };
        } catch (e) {
            console.log(`[content] en not found, trying original...`);
        }
    }
    
    // Fallback to original URL (source content)
    const content = await fetchContentDirect(url);
    return { content, lang: 'source', url };
}

/**
 * Fetch content directly (no i18n fallback).
 * Used internally by fetchContentWithI18nFallback.
 */
async function fetchContentDirect(url) {
    // Use proxy for GitHub URLs (private repos need auth)
    const fetchUrl = isGitHubUrl(url) ? buildProxyUrl(url) : url;
    
    const headers = {
        'Accept': 'text/plain, text/markdown, */*'
    };
    
    // Add JWT for proxy requests
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
 * Fetch content from a repository URL
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
        console.error('Content fetch error:', error);
        throw error;
    }
}

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
export async function fetchMarkdown(url, options = {}) {
    const { 
        resolveImages = true, 
        stripYamlFrontmatter = true, 
        cleanForLms = true,
        useI18n = true 
    } = options;
    
    let markdown;
    let actualUrl = url;
    
    if (useI18n) {
        // Use i18n fallback: try current lang -> en -> source
        const result = await fetchContentWithI18nFallback(url);
        markdown = result.content;
        actualUrl = result.url;
    } else {
        markdown = await fetchContent(url);
    }
    
    // Strip YAML frontmatter (common in SOM markdown files)
    if (stripYamlFrontmatter) {
        markdown = stripFrontmatter(markdown);
    }
    
    // Clean up for LMS display (remove video URLs, dead links, etc.)
    if (cleanForLms) {
        markdown = cleanMarkdownForLms(markdown);
    }
    
    if (resolveImages) {
        markdown = resolveRelativeUrls(markdown, actualUrl);
    }
    
    return markdown;
}

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

/**
 * Resolve a relative path against a base URL
 * @param {string} baseDir - Base directory URL (with trailing slash)
 * @param {string} path - Relative path
 * @returns {string} - Absolute URL
 */
function resolvePath(baseDir, path) {
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

/**
 * Parse media URL to determine content source
 * @param {Object} media - Media object from lms_class
 * @returns {Object} - { type, url, canFetch }
 */
export function parseMediaUrl(media) {
    if (!media || !media.url) {
        return { type: null, url: null, canFetch: false };
    }
    
    const url = media.url;
    const type = media.type || 'UNKNOWN';
    
    // GitHub raw URLs - can fetch directly
    if (url.includes('raw.githubusercontent.com')) {
        return { type: 'GITHUB_RAW', url, canFetch: true, source: 'github' };
    }
    
    // Cloudflare Stream
    if (url.includes('cloudflarestream.com')) {
        return { type: 'VIDEO', url, canFetch: false, source: 'cloudflare' };
    }
    
    // Tally forms
    if (url.includes('tally.so')) {
        return { type: 'QUIZ', url, canFetch: false, source: 'tally' };
    }
    
    // Generic document URL
    if (type === 'DOCUMENT') {
        return { type: 'DOCUMENT', url, canFetch: true, source: 'external' };
    }
    
    return { type, url, canFetch: false, source: 'unknown' };
}

/**
 * Get document URL from class media
 * @param {Object} cls - Class object
 * @returns {string|null} - Document URL or null
 */
export function getDocumentUrl(cls) {
    const media = cls.media || [];
    const docMedia = media.find(m => m.type === 'DOCUMENT');
    return docMedia?.url || null;
}

/**
 * Clear content cache
 */
export function clearCache() {
    contentCache.clear();
}

/**
 * Preload content for upcoming steps
 * @param {Array<string>} urls - URLs to preload
 */
export async function preloadContent(urls) {
    const promises = urls
        .filter(url => url && !contentCache.has(url))
        .map(url => fetchContent(url).catch(() => null));
    
    await Promise.all(promises);
}
