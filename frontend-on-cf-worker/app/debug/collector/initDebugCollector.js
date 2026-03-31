// entropy-long-function-ok: single init function with sequential setup steps
/**
 * Initialize the debug collector
 * Call this once at app startup
 */

import { storage, storeError, storeBreadcrumb, storeNetworkError, describeElement, log } from './_shared.js';

export const initDebugCollector = () => {
    if (storage.initialized) {
        log.debug('[Debug] Collector already initialized');
        return;
    }

    // 1. Patch window.onerror
    const originalOnError = window.onerror;
    window.onerror = function(message, url, line, column, error) { // entropy-global-pollution-ok: intentional global error handler // entropy-orphan-global-ok: patching native
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
    window.addEventListener('unhandledrejection', function(event) {
        const error = event.reason;
        storeError({
            message: error?.message || String(error),
            stack: error?.stack,
            type: 'unhandledrejection'
        });
    });

    // 3. Patch console.error
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const message = args.map(a => { // entropy-naming-convention-ok: singular message string being built
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
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) { // entropy-global-pollution-ok: intentional fetch interceptor for debug // entropy-orphan-global-ok: patching native
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

    // 7. Track page visibility
    document.addEventListener('visibilitychange', function() {
        storeBreadcrumb({
            type: 'visibility',
            data: document.hidden ? 'hidden' : 'visible'
        });
    });

    storeBreadcrumb({
        type: 'init',
        data: `Page loaded: ${window.location.pathname}${window.location.search}`
    });

    storage.initialized = true;
    log.debug('[Debug] Collector initialized');
};
