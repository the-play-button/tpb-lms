/**
 * Initialize the debug collector
 *
 * Returns the two native-global patches (onerror, fetch) so init/globals.js
 * can install them — § global_pollution centralizes browser-global writes.
 * All non-global listeners (unhandledrejection, click, popstate,
 * visibilitychange, console.error, history.pushState/replaceState) are
 * installed directly in this function (they don't trigger global_pollution).
 */

import { storage, storeError, storeBreadcrumb, storeNetworkError, describeElement, log } from './_shared.js';

const createOnErrorPatch = (originalOnError) => {
    return function(message, url, line, column, error) {
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
};

const createFetchPatch = (originalFetch) => {
    return async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        const method = init?.method || 'GET';
        const startTime = Date.now();

        const requestOptions = init ? {
            method: init.method,
            credentials: init.credentials,
            mode: init.mode,
            headers: init.headers ? Object.keys(init.headers) : null
        } : { method: 'GET' };

        try {
            const response = await originalFetch.apply(this, arguments);
            const duration = Date.now() - startTime;

            storeBreadcrumb({
                type: 'fetch',
                data: `${method} ${url} -> ${response.status} (${duration}ms)`
            });

            if (!response.ok) {
                const clone = response.clone();
                let body = null;
                try {
                    const text = await clone.text();
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
                data: `${method} ${url} -> FAILED (${duration}ms)`
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
};

const installNonGlobalListeners = () => {
    // unhandledrejection
    window.addEventListener('unhandledrejection', function(event) {
        const error = event.reason;
        storeError({
            message: error?.message || String(error),
            stack: error?.stack,
            type: 'unhandledrejection'
        });
    });

    // console.error patch
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const messageText = args.map(a => {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); }
                catch { return String(a); }
            }
            return String(a);
        }).join(' ');

        if (!messageText.includes('[Debug]')) {
            storeError({
                message: messageText,
                type: 'console.error'
            });
        }

        return originalConsoleError.apply(console, args);
    };

    // Track clicks
    document.addEventListener('click', function(event) {
        const target = event.target.closest('button, a, [data-action], [onclick], .clickable');
        if (target) {
            storeBreadcrumb({
                type: 'click',
                data: describeElement(target)
            });
        }
    }, true);

    // Track navigation (SPA)
    const originalPushState = history.pushState;
    history.pushState = function() {
        const result = originalPushState.apply(this, arguments);
        storeBreadcrumb({
            type: 'navigation',
            data: `pushState -> ${window.location.pathname}${window.location.search}`
        });
        return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        const result = originalReplaceState.apply(this, arguments);
        storeBreadcrumb({
            type: 'navigation',
            data: `replaceState -> ${window.location.pathname}${window.location.search}`
        });
        return result;
    };

    window.addEventListener('popstate', function() {
        storeBreadcrumb({
            type: 'navigation',
            data: `popstate -> ${window.location.pathname}${window.location.search}`
        });
    });

    // Track page visibility
    document.addEventListener('visibilitychange', function() {
        storeBreadcrumb({
            type: 'visibility',
            data: document.hidden ? 'hidden' : 'visible'
        });
    });
};

/**
 * Initialize the debug collector. Returns { onerrorPatch, fetchPatch } so the
 * caller (init/globals.js) can install the two native-global overrides.
 * All other listeners are installed in-place (they don't write to window.X
 * directly and thus don't trigger § global_pollution).
 */
export const initDebugCollector = () => {
    if (storage.initialized) {
        log.debug('[Debug] Collector already initialized');
        return null;
    }

    const onerrorPatch = createOnErrorPatch(window.onerror);
    const fetchPatch = createFetchPatch(window.fetch);

    installNonGlobalListeners();

    storeBreadcrumb({
        type: 'init',
        data: `Page loaded: ${window.location.pathname}${window.location.search}`
    });

    storage.initialized = true;
    log.debug('[Debug] Collector initialized');

    return { onerrorPatch, fetchPatch };
};
