/**
 * Logto OAuth Handlers for LMS
 *
 * These routes handle the Logto OIDC login/callback/logout flow.
 * Only active when USE_LOGTO=true.
 *
 * Routes:
 *   GET /auth/login    -> Redirect to Logto sign-in
 *   GET /auth/callback -> Handle Logto callback (exchange code for session)
 *   GET /auth/logout   -> Redirect to Logto sign-out
 */

import { getAuthConfig } from '../config/auth.js';

/**
 * GET /auth/login
 * Redirects the user to Logto's sign-in page
 */
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

/**
 * GET /auth/callback
 * Handles the Logto callback after successful authentication.
 * In a Worker environment, this exchanges the code for tokens
 * and redirects to the app with a session cookie.
 */
export async function handleCallback(request, env) {
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

  // Exchange code for tokens
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

  // Set the ID token as a cookie and redirect to the app
  const headers = new Headers();
  headers.set('Location', '/');
  headers.set('Set-Cookie',
    `logto_id_token=${tokens.id_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${tokens.expires_in || 3600}`
  );

  return new Response(null, { status: 302, headers });
}

/**
 * GET /auth/logout
 * Redirects the user to Logto's sign-out endpoint
 */
export async function handleLogout(request, env) {
  const authConfig = getAuthConfig(env);

  if (!authConfig.useLogto) {
    return new Response('Logto not enabled', { status: 404 });
  }

  const url = new URL(request.url);
  const postLogoutUri = url.origin;

  const logoutUrl = new URL(`${authConfig.logto.endpoint}/oidc/session/end`);
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutUri);
  logoutUrl.searchParams.set('client_id', authConfig.logto.appId);

  // Clear the session cookie
  const headers = new Headers();
  headers.set('Location', logoutUrl.toString());
  headers.set('Set-Cookie',
    'logto_id_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  );

  return new Response(null, { status: 302, headers });
}
