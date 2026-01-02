/**
 * Structured Logger
 * GAPs: GAP-1101, GAP-1103, GAP-1104
 * 
 * JSON structured logging with component tags.
 * Compatible with Cloudflare Workers (console-based).
 */

const log = (level, component, message, data = {}) => {
  const entry = {
    ts: new Date().toISOString(),
    level,
    component,
    message,
    ...data
  };
  
  if (level === 'ERROR' && data.error instanceof Error) {
    entry.stack = data.error.stack;
    entry.error = data.error.message;
  }
  
  console.log(JSON.stringify(entry));
};

export const logger = (component) => ({
  info: (msg, data) => log('INFO', component, msg, data),
  warn: (msg, data) => log('WARN', component, msg, data),
  error: (msg, data) => log('ERROR', component, msg, data),
  audit: (action, data) => log('AUDIT', component, action, { ...data, audit: true })
});

export default logger;

