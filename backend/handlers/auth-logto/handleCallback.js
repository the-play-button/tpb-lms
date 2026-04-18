// entropy-handler-service-pattern-ok: handleCallback handler delegates to backend, minimal orchestration logic
/**
 * GET /auth/callback
 * Handles the Logto callback after successful authentication.
 */

import { getAuthConfig } from '../../config/auth.js';

export const handleCallback = async (request, env) => {
    const authConfig = getAuthConfig(env);

    if (!authConfig.useLogto) {
        return new Response('Logto not enabled', { status: 404 });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
        return new Response(JSON.stringify({
            error: 'Authentication failed',
            detail: url.searchParams.get('error_description') || error,
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!code) {
        return new Response(JSON.stringify({ error: 'Missing authorization code' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const tokenUrl = `${authConfig.logto.endpoint}/oidc/token`;
    const redirectUri = `${url.origin}/auth/callback`;

    const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: authConfig.logto.appId,
            client_secret: env.LOGTO_APP_SECRET || '',
        }),
    });

    if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        console.error('[Auth] Token exchange failed:', body);
        return new Response(JSON.stringify({ error: 'Token exchange failed' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const tokens = await tokenResponse.json();

    const headers = new Headers();
    headers.set('Location', '/');
    headers.set('Set-Cookie',
        `logto_id_token=${tokens.id_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${tokens.expires_in || 3600}`
    );

    return new Response(null, { status: 302, headers });
};
