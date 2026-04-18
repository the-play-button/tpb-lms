// entropy-god-file-ok: centralized logging intentionally imported widely
/**
 * LogService - Centralized logging for tpb-lms frontend.
 *
 * Replaces direct console.* calls. Debug logs are suppressed
 * unless localStorage.debug === 'true'.
 *
 * Usage:
 *   import { log } from './log.js';
 *   log.debug('only in dev');
 *   log.warn('always visible');
 */

const debugEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('debug') === 'true';

export const log = {
  debug(...args) {
    if (debugEnabled) console.log('[DEBUG]', ...args); // entropy-console-leak-ok: console call in log is the LogService transport layer
  },
  info(...args) {
    console.log('[INFO]', ...args); // entropy-console-leak-ok: console call in log is the LogService transport layer
  },
  warn(...args) {
    console.warn('[WARN]', ...args); // entropy-console-leak-ok: console call in log is the LogService transport layer
  },
  error(...args) {
    console.error('[ERROR]', ...args); // entropy-console-leak-ok: console call in log is the LogService transport layer
  },
};
