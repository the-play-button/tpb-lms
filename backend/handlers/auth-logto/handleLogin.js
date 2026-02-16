/**
 * GET /auth/login
 * Redirects the user to Logto's sign-in page
 */

import { getAuthConfig } from '../../config/auth.js';

export async function handleLogin(request, env) {
    const authConfig = getAuthConfig(env);

    if (!authConfig.useLogto) {
        return new Response('Logto not enabled', { status: 404 });
    }

    const url = new URL(request.url);
    const redirectUri = `${url.origin}/auth/callback`;
    const state = crypto.randomUUID();

    const loginUrl = new URL(`${authConfig.logto.endpoint}/oidc/auth`);
    loginUrl.searchParams.set('client_id', authConfig.logto.appId);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('response_type', 'code');
    loginUrl.searchParams.set('scope', 'openid profile email');
    loginUrl.searchParams.set('state', state);

    return Response.redirect(loginUrl.toString(), 302);
}
