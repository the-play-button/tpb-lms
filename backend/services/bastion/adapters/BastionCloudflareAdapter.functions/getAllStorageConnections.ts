import type { ConnectionInfo } from '../../../types/ConnectionInfo.types.js';
import { createBastionClient } from '@the-play-button/tpb-sdk-js';

// § SDK PURE HTTP CLIENTS — consume listMyConnections (caller JWT → /core/connections/me, category-scoped)
// instead of hand-rolling the endpoint. All results are storage (server-side category filter) → map to
// the lms ConnectionInfo shape.
export const getAllStorageConnections = async (bastionUrl: string, jwt: string): Promise<ConnectionInfo[]> => {
  const result = await createBastionClient({ bastionUrl, serviceToken: '' }).listMyConnections({ Authorization: `Bearer ${jwt}` }, 'storage');
  if (!result.ok) {
    return [];
  }
  return result.value.map((c) => ({ id: c.id, integrationType: c.integrationType, category: 'storage' }));
};
