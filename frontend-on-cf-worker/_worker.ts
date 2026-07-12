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

interface FrontendWorkerEnv {
    ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
    async fetch(request: Request, env: FrontendWorkerEnv): Promise<Response> {
        const url = new URL(request.url);
        
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
        
        const response = await env.ASSETS.fetch(request);
        
        if (response.status === 404 && !url.pathname.includes('.')) {
            const indexRequest = new Request(new URL('/index.html', request.url), request);
            return env.ASSETS.fetch(indexRequest);
        }
        
        return response;
    }
};

