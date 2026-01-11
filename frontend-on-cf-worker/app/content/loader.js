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
 * Fetch markdown content and resolve relative URLs
 * @param {string} url - Raw URL to fetch
 * @param {Object} options - Options
 * @param {boolean} options.resolveImages - Resolve relative image URLs (default: true)
 * @returns {Promise<string>} - Markdown content with resolved URLs
 */
export async function fetchMarkdown(url, options = {}) {
    const { resolveImages = true } = options;
    
    let markdown = await fetchContent(url);
    
    if (resolveImages) {
        markdown = resolveRelativeUrls(markdown, url);
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
