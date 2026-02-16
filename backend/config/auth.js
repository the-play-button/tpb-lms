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
export function getAuthConfig(env) {
  return {
    useLogto: env.USE_LOGTO === 'true',

    cfAccess: {
      teamDomain: env.ACCESS_TEAM_DOMAIN || 'theplaybutton',
    },

    logto: {
      endpoint: env.LOGTO_ENDPOINT || 'https://auth.theplaybutton.dev',
      appId: env.LOGTO_APP_ID || null,
      issuer: env.LOGTO_ISSUER || env.LOGTO_ENDPOINT || 'https://auth.theplaybutton.dev/oidc',
      jwksUri: env.LOGTO_JWKS_URI || null,
    },
  };
}
