export const log = {
  debug(...args) { if (typeof process !== 'undefined' && process.env?.DEBUG) console.log('[DEBUG]', ...args); }, // entropy-console-leak-ok: console call in log is the LogService transport layer
  info(...args) { console.log('[INFO]', ...args); }, // entropy-console-leak-ok: console call in log is the LogService transport layer
  warn(...args) { console.warn('[WARN]', ...args); }, // entropy-console-leak-ok: console call in log is the LogService transport layer
  error(...args) { console.error('[ERROR]', ...args); }, // entropy-console-leak-ok: console call in log is the LogService transport layer
};
