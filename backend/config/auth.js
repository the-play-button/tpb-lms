/**
 * Auth Configuration for LMS
 *
 * CF Access is the sole authentication layer.
 */

/**
 * Build auth config from worker env
 * @param {object} env - Cloudflare Worker env
 */
export const getAuthConfig = env => ({
  cfAccess: {
    teamDomain: env.ACCESS_TEAM_DOMAIN || 'theplaybutton',
  },
});
