/**
 * Trace Middleware
 * GAP: GAP-1106
 * 
 * Adds x-trace-id header for request correlation.
 */

export const addTraceId = (request) => {
  const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
  return { traceId };
};

export const withTraceHeader = (response, traceId) => {
  const headers = new Headers(response.headers);
  headers.set('x-trace-id', traceId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

