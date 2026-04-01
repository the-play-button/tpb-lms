import type { RevokeShareOutput } from './revokeShareExecute.js';

/**
 * Filter step: pass-through for revoke response.
 *
 * The revoke output (share_id, content_ref_id, revoked_at) contains
 * no sensitive fields to strip.
 */
export const revokeShareFilter = (output: RevokeShareOutput): RevokeShareOutput => {
  return output;
};
