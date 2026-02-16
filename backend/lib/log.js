export const log = {
  debug(...args) { if (typeof process !== 'undefined' && process.env?.DEBUG) console.log('[DEBUG]', ...args); }, // entropy-console-leak-ok: LogService implementation
  info(...args) { console.log('[INFO]', ...args); }, // entropy-console-leak-ok: LogService implementation
  warn(...args) { console.warn('[WARN]', ...args); }, // entropy-console-leak-ok: LogService implementation
  error(...args) { console.error('[ERROR]', ...args); }, // entropy-console-leak-ok: LogService implementation
};
