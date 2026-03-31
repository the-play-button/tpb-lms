/**
 * Gather all debug information
 */

import { storage, getDeviceInfo, getAppState } from './_shared.js';

export const gatherDebugInfo = () => {
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
};
