/**
 * Debug Collector Module
 * 
 * Collects technical information for debugging without polluting the codebase.
 * Uses monkey-patching and global handlers to automatically capture:
 * - Errors (window.onerror, unhandledrejection, console.error)
 * - Network requests (fetch wrapper)
 * - User actions (clicks, navigation)
 * - Device fingerprint
 * - App state
 */

// Storage limits
const MAX_ERRORS = 10;
const MAX_BREADCRUMBS = 50;
const MAX_NETWORK_ERRORS = 10;

// Internal storage
const storage = {
    errors: [],
    breadcrumbs: [],
    networkErrors: [],
    userContext: null,
    initialized: false
};

// Original functions (saved before patching)
let originalOnError = null;
let originalOnUnhandledRejection = null;
let originalConsoleError = null;
let originalFetch = null;
let originalPushState = null;
let originalReplaceState = null;

/**
 * Store an error
 */
function storeError(error) {
    storage.errors.unshift({
        message: error.message || String(error),
        stack: error.stack || null,
        type: error.type || 'error',
        url: error.url || null,
        line: error.line || null,
        column: error.column || null,
        timestamp: new Date().toISOString()
    });
    
    // Keep only the last N errors
    if (storage.errors.length > MAX_ERRORS) {
        storage.errors.pop();
    }
}

/**
 * Store a breadcrumb
 */
function storeBreadcrumb(breadcrumb) {
    storage.breadcrumbs.unshift({
        type: breadcrumb.type,
        data: breadcrumb.data,
        timestamp: new Date().toISOString()
    });
    
    // Keep only the last N breadcrumbs
    if (storage.breadcrumbs.length > MAX_BREADCRUMBS) {
        storage.breadcrumbs.pop();
    }
}

/**
 * Store a network error with full context
 */
function storeNetworkError(error) {
    storage.networkErrors.unshift({
        url: error.url,
        method: error.method || 'GET',
        status: error.status || null,
        statusText: error.statusText || null,
        error: error.error || null,
        // Full response body (truncated)
        body: error.body || null,
        // Request options that were used
        requestOptions: error.requestOptions || null,
        timestamp: new Date().toISOString()
    });
    
    // Keep only the last N network errors
    if (storage.networkErrors.length > MAX_NETWORK_ERRORS) {
        storage.networkErrors.pop();
    }
}

/**
 * Describe a DOM element for breadcrumbs
 */
function describeElement(el) {
    if (!el) return 'unknown';
    
    const tag = el.tagName?.toLowerCase() || 'element';
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string' 
        ? '.' + el.className.split(' ').filter(c => c).slice(0, 2).join('.')
        : '';
    const text = el.textContent?.slice(0, 30)?.trim() || '';
    const textPreview = text ? ` "${text}${text.length >= 30 ? '...' : ''}"` : '';
    
    return `${tag}${id}${classes}${textPreview}`;
}

/**
 * Get device fingerprint
 */
function getDeviceInfo() {
    const nav = navigator;
    const screen = window.screen;
    
    return {
        userAgent: nav.userAgent,
        platform: nav.platform,
        language: nav.language,
        languages: nav.languages?.join(', ') || nav.language,
        cookieEnabled: nav.cookieEnabled,
        online: nav.onLine,
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
        memory: nav.deviceMemory || null,
        cores: nav.hardwareConcurrency || null
    };
}

/**
 * Get current app state
 */
function getAppState() {
    // Try to get state from the global state module if available
    let appState = {
        url: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer || null,
        title: document.title
    };
    
    // Try to get course state from URL params
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('som') || params.get('course');
    const step = params.get('step');
    
    if (courseId) appState.course_id = courseId;
    if (step) appState.step = parseInt(step, 10);
    
    return appState;
}

/**
 * Initialize the debug collector
 * Call this once at app startup
 */
export function initDebugCollector() {
    if (storage.initialized) {
        console.warn('[Debug] Collector already initialized');
        return;
    }
    
    // 1. Patch window.onerror
    originalOnError = window.onerror;
    window.onerror = function(message, url, line, column, error) {
        storeError({
            message: message,
            stack: error?.stack,
            url: url,
            line: line,
            column: column,
            type: 'uncaught'
        });
        
        if (originalOnError) {
            return originalOnError.apply(this, arguments);
        }
        return false;
    };
    
    // 2. Patch unhandledrejection
    originalOnUnhandledRejection = window.onunhandledrejection;
    window.addEventListener('unhandledrejection', function(event) {
        const error = event.reason;
        storeError({
            message: error?.message || String(error),
            stack: error?.stack,
            type: 'unhandledrejection'
        });
    });
    
    // 3. Patch console.error
    originalConsoleError = console.error;
    console.error = function(...args) {
        // Don't store if it's from our own debug module
        const message = args.map(a => {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } 
                catch { return String(a); }
            }
            return String(a);
        }).join(' ');
        
        if (!message.includes('[Debug]')) {
            storeError({
                message: message,
                type: 'console.error'
            });
        }
        
        return originalConsoleError.apply(console, args);
    };
    
    // 4. Patch fetch - capture full request/response context
    originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        const method = init?.method || 'GET';
        const startTime = Date.now();
        
        // Capture request options (sanitized - no secrets)
        const requestOptions = init ? {
            method: init.method,
            credentials: init.credentials,
            mode: init.mode,
            headers: init.headers ? Object.keys(init.headers) : null
        } : { method: 'GET' };
        
        try {
            const response = await originalFetch.apply(this, arguments);
            const duration = Date.now() - startTime;
            
            // Store as breadcrumb
            storeBreadcrumb({
                type: 'fetch',
                data: `${method} ${url} → ${response.status} (${duration}ms)`
            });
            
            // Store network errors (4xx, 5xx) with response body
            if (!response.ok) {
                // Clone response to read body without consuming it
                const clone = response.clone();
                let body = null;
                try {
                    const text = await clone.text();
                    // Truncate and try to parse as JSON for readability
                    if (text.length <= 1000) {
                        try { body = JSON.parse(text); } 
                        catch { body = text; }
                    } else {
                        body = text.slice(0, 1000) + '... [truncated]';
                    }
                } catch { /* ignore */ }
                
                storeNetworkError({
                    url: url,
                    method: method,
                    status: response.status,
                    statusText: response.statusText,
                    body: body,
                    requestOptions: requestOptions
                });
            }
            
            return response;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            storeBreadcrumb({
                type: 'fetch',
                data: `${method} ${url} → FAILED (${duration}ms)`
            });
            
            storeNetworkError({
                url: url,
                method: method,
                error: error.message,
                requestOptions: requestOptions
            });
            
            throw error;
        }
    };
    
    // 5. Track clicks
    document.addEventListener('click', function(event) {
        const target = event.target.closest('button, a, [data-action], [onclick], .clickable');
        if (target) {
            storeBreadcrumb({
                type: 'click',
                data: describeElement(target)
            });
        }
    }, true);
    
    // 6. Track navigation (SPA)
    originalPushState = history.pushState;
    history.pushState = function() {
        const result = originalPushState.apply(this, arguments);
        storeBreadcrumb({
            type: 'navigation',
            data: `pushState → ${window.location.pathname}${window.location.search}`
        });
        return result;
    };
    
    originalReplaceState = history.replaceState;
    history.replaceState = function() {
        const result = originalReplaceState.apply(this, arguments);
        storeBreadcrumb({
            type: 'navigation',
            data: `replaceState → ${window.location.pathname}${window.location.search}`
        });
        return result;
    };
    
    window.addEventListener('popstate', function() {
        storeBreadcrumb({
            type: 'navigation',
            data: `popstate → ${window.location.pathname}${window.location.search}`
        });
    });
    
    // 7. Track page visibility
    document.addEventListener('visibilitychange', function() {
        storeBreadcrumb({
            type: 'visibility',
            data: document.hidden ? 'hidden' : 'visible'
        });
    });
    
    // Initial breadcrumb
    storeBreadcrumb({
        type: 'init',
        data: `Page loaded: ${window.location.pathname}${window.location.search}`
    });
    
    storage.initialized = true;
    console.log('[Debug] Collector initialized');
}

/**
 * Set user context (call after authentication)
 */
export function setUserContext(user) {
    storage.userContext = {
        email: user?.email || null,
        user_id: user?.id || user?.sub || null,
        contact_id: user?.contact_id || null
    };
}

/**
 * Add a manual breadcrumb
 */
export function addBreadcrumb(type, data) {
    storeBreadcrumb({ type, data });
}

/**
 * Gather all debug information
 */
export function gatherDebugInfo() {
    return {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        user: storage.userContext || { note: 'User context not set' },
        device: getDeviceInfo(),
        app: getAppState(),
        errors: [...storage.errors],
        breadcrumbs: [...storage.breadcrumbs],
        network_errors: [...storage.networkErrors],
        sentry: window.Sentry ? 'enabled' : 'not loaded'
    };
}

/**
 * Copy debug info to clipboard
 */
export async function copyDebugInfoToClipboard() {
    const info = gatherDebugInfo();
    const json = JSON.stringify(info, null, 2);
    
    try {
        await navigator.clipboard.writeText(json);
        return { success: true, data: info };
    } catch (error) {
        // Fallback for older browsers or permission denied
        const textarea = document.createElement('textarea');
        textarea.value = json;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return { success: true, data: info };
        } catch (e) {
            document.body.removeChild(textarea);
            return { success: false, error: e.message, data: info };
        }
    }
}

