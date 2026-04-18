/**
 * Auth Configuration for LMS
 *
 * Feature flag to toggle between CF Access and Logto SSO.
 * Set USE_LOGTO=true in wrangler.toml or env to enable Logto.
 *
 * Rollback: Set USE_LOGTO=false to revert to CF Access.
 */

/**
 * Build auth config from worker env
 * @param {object} env - Cloudflare Worker env
 */
export const getAuthConfig = env => {
  return {
    useLogto: env.USE_LOGTO === 'true',

    cfAccess: {
      teamDomain: env.ACCESS_TEAM_DOMAIN || 'theplaybutton',
    },

    logto: {
      endpoint: env.LOGTO_ENDPOINT || 'https://auth.theplaybutton.dev', // entropy-hardcoded-url-ok: URL in auth is a fallback deployment configuration
      appId: env.LOGTO_APP_ID || null,
      issuer: env.LOGTO_ISSUER || env.LOGTO_ENDPOINT || 'https://auth.theplaybutton.dev/oidc', // entropy-hardcoded-url-ok: URL in auth is a fallback deployment configuration
      jwksUri: env.LOGTO_JWKS_URI || null,
    },
  };
};
