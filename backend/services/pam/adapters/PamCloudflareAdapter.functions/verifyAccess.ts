import type { PamVerifyResult } from '../../PamPort.js';
import { pamFetch } from './pamFetch.js';

/**
 * Verify guest access to a file via PAM
 *
 * Returns { allowed: false } on HTTP errors rather than throwing,
 * since access denial is a normal control flow outcome.
 */
export async function verifyAccess(
  bastionUrl: string,
  getToken: () => string,
  connectionId: string,
  fileId: string,
  guestEmail: string
): Promise<PamVerifyResult> {
  const response = await pamFetch(bastionUrl, getToken, 'storage', 'file', 'verify', {
    connectionId,
    entityId: fileId,
    guestEmail,
  });

  if (!response.ok) {
    return { allowed: false };
  }

  return await response.json() as { success?: boolean; allowed: boolean; owner?: { email: string } };
}
