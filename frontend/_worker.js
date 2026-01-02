/**
 * Frontend Worker with Auth Token Endpoint
 * 
 * Exposes the Cloudflare Access JWT to the frontend JavaScript.
 * This solves Safari ITP blocking cross-origin cookies.
 * 
 * Routes:
 * - /__auth/token → Returns the CF Access JWT for API calls
 * - /* → Serve static assets
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Auth token endpoint - expose JWT to frontend JS
        if (url.pathname === '/__auth/token') {
            const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
            
            if (!jwt) {
                return new Response(JSON.stringify({ 
                    error: 'Not authenticated',
                    message: 'No Cloudflare Access JWT found. Please login.'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            return new Response(JSON.stringify({ token: jwt }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate'
                }
            });
        }
        
        // Serve static assets
        // For SPA routing: serve index.html for paths that don't match files
        const response = await env.ASSETS.fetch(request);
        
        // If asset not found (404) and it's a navigation request, serve index.html
        if (response.status === 404 && !url.pathname.includes('.')) {
            // Rewrite to index.html for SPA routing
            const indexRequest = new Request(new URL('/index.html', request.url), request);
            return env.ASSETS.fetch(indexRequest);
        }
        
        return response;
    }
};

