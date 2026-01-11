/**
 * Frontend Logger - Standardized logging format
 * GAP-1102: Format standardisé pour debug frontend
 * 
 * Usage:
 *   import { log } from './utils/log.js';
 *   log.info('video', 'Event sent', { type, position });
 *   log.error('quiz', 'Submission failed', { error });
 */

const DEV_MODE = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' ||
                 window.location.search.includes('debug=true');

const format = (level, component, message, data) => {
    const prefix = `[${level}][${component}]`;
    return { prefix, message, data };
};

export const log = {
    info: (component, message, data) => {
        if (DEV_MODE) {
            const { prefix } = format('INFO', component, message, data);
            console.log(prefix, message, data || '');
        }
    },
    warn: (component, message, data) => {
        const { prefix } = format('WARN', component, message, data);
        console.warn(prefix, message, data || '');
    },
    error: (component, message, data) => {
        const { prefix } = format('ERROR', component, message, data);
        console.error(prefix, message, data || '');
    },
    debug: (component, message, data) => {
        if (DEV_MODE) {
            const { prefix } = format('DEBUG', component, message, data);
            console.log(prefix, message, data || '');
        }
    }
};

// Global access for non-module scripts
window.LMSLog = log;

export default log;

