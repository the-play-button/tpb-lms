/**
 * GET /auth/logout
 * Redirects the user to Logto's sign-out endpoint
 */

import { getAuthConfig } from '../../config/auth.js';

export const handleLogout = async (request, env) => {
    const authConfig = getAuthConfig(env);

    if (!authConfig.useLogto) {
        return new Response('Logto not enabled', { status: 404 });
    }

    const logoutUrl = new URL(`${authConfig.logto.endpoint}/oidc/session/end`);
    logoutUrl.searchParams.set('post_logout_redirect_uri', new URL(request.url).origin);
    logoutUrl.searchParams.set('client_id', authConfig.logto.appId);

    const headers = new Headers();
    headers.set('Location', logoutUrl.toString());
    headers.set('Set-Cookie',
        'logto_id_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );

    return new Response(null, { status: 302, headers });
};
