/**
 * Shared debug collector state and storage helpers
 */

import { log } from '../../log.js';

export const MAX_ERRORS = 10;
export const MAX_BREADCRUMBS = 50;
export const MAX_NETWORK_ERRORS = 10;

export const storage = {
    errors: [],
    breadcrumbs: [],
    networkErrors: [],
    userContext: null,
    initialized: false
};

export { log };

/**
 * Store an error
 */
export const storeError = error => {
    storage.errors.unshift({
        message: error.message || String(error),
        stack: error.stack || null,
        type: error.type || 'error',
        url: error.url || null,
        line: error.line || null,
        column: error.column || null,
        timestamp: new Date().toISOString()
    });

    if (storage.errors.length > MAX_ERRORS) {
        storage.errors.pop();
    }
};

/**
 * Store a breadcrumb
 */
export const storeBreadcrumb = breadcrumb => {
    storage.breadcrumbs.unshift({
        type: breadcrumb.type,
        data: breadcrumb.data,
        timestamp: new Date().toISOString()
    });

    if (storage.breadcrumbs.length > MAX_BREADCRUMBS) {
        storage.breadcrumbs.pop();
    }
};

/**
 * Store a network error with full context
 */
export const storeNetworkError = error => {
    storage.networkErrors.unshift({
        url: error.url,
        method: error.method || 'GET',
        status: error.status || null,
        statusText: error.statusText || null,
        error: error.error || null,
        body: error.body || null,
        requestOptions: error.requestOptions || null,
        timestamp: new Date().toISOString()
    });

    if (storage.networkErrors.length > MAX_NETWORK_ERRORS) {
        storage.networkErrors.pop();
    }
};

/**
 * Describe a DOM element for breadcrumbs
 */
export const describeElement = el => {
    if (!el) return 'unknown';

    const tag = el.tagName?.toLowerCase() || 'element';
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string'
        ? '.' + el.className.split(' ').filter(c => c).slice(0, 2).join('.')
        : '';
    const text = el.textContent?.slice(0, 30)?.trim() || '';
    const textPreview = text ? ` "${text}${text.length >= 30 ? '...' : ''}"` : '';

    return `${tag}${id}${classes}${textPreview}`;
};

/**
 * Get device fingerprint
 */
export const getDeviceInfo = () => {
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
};

/**
 * Get current app state
 */
export const getAppState = () => {
    let appState = {
        url: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer || null,
        title: document.title
    };

    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('som') || params.get('course');
    const step = params.get('step');

    if (courseId) appState.course_id = courseId;
    if (step) appState.step = parseInt(step, 10);

    return appState;
};
