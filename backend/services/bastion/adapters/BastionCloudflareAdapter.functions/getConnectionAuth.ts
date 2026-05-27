import { bastionFetch } from './bastionFetch.js';
import { ServiceUnavailableError } from '../../../../types/errors.js';

export interface BastionConnectionAuth {
  access_token?: string;
  other_auth_info?: Array<{ key: string; value: string }>;
}

/**
 * GET /core/connections/{id}/auth
 *
 * Returns the OAuth access_token (and other auth info) for the user's storage
 * connection. Bastion is the SSOT — it resolves the connection's owner against
 * the calling JWT and returns the auth row from D1 (post core-sync chain drop
 * 2026-05-27).
 */
export const getConnectionAuth = async (
  bastionUrl: string,
  jwt: string,
  connectionId: string,
): Promise<BastionConnectionAuth> => {
  const response = await bastionFetch(bastionUrl, `/core/connections/${connectionId}/auth`, jwt);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ServiceUnavailableError(
      'bastion',
      `getConnectionAuth ${connectionId} failed: HTTP ${response.status} — ${text}`,
    );
  }
  const data = (await response.json()) as { auth?: BastionConnectionAuth };
  if (!data.auth) {
    throw new ServiceUnavailableError('bastion', `getConnectionAuth ${connectionId} returned no auth payload`);
  }
  return data.auth;
};
