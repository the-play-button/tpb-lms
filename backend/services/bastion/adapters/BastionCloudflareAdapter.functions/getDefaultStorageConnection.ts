import type { ConnectionInfo } from '../../../types/ConnectionInfo.types.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import { createBastionClient } from '@the-play-button/tpb-sdk-js';

// § SDK PURE HTTP CLIENTS — consume the SDK BastionClient's getDefaultConnection (caller JWT →
// /core/connections/me/default?category=storage). The bastion returns {connection: single|null}:
// null (no default set) → NotFound; a transport/bastion error → ServiceUnavailable.
export const getDefaultStorageConnection = async (bastionUrl: string, jwt: string): Promise<ConnectionInfo> => {
  const result = await createBastionClient({ bastionUrl, serviceToken: '' }).getDefaultConnection('storage', { Authorization: `Bearer ${jwt}` });
  if (!result.ok) {
    throw new ServiceUnavailableError('Storage connection', result.error);
  }
  if (!result.value) {
    throw new NotFoundError('Storage connection', 'Please connect your cloud storage in settings.');
  }
  return { id: result.value.id, integrationType: result.value.integrationType, category: 'storage' };
};
