import type { ConnectionInfo } from '../../../types/ConnectionInfo.types.js';
import { createBastionClient } from '@the-play-button/tpb-sdk-js';

// § SDK PURE HTTP CLIENTS — consume the SDK BastionClient's listMyConnections (caller JWT → /core/connections/me)
// instead of hand-rolling the endpoint, then narrow to the requested provider. listMyConnections has no
// integrationType filter arg, so we filter client-side. BastionConnection carries `categories: string[]`
// (the singular `category` isn't on the SDK type) → map to the lms ConnectionInfo shape.
export const getConnectionsByProvider = async (bastionUrl: string, jwt: string, provider: string): Promise<ConnectionInfo[]> => {
  const result = await createBastionClient({ bastionUrl, serviceToken: '' }).listMyConnections({ Authorization: `Bearer ${jwt}` });
  if (!result.ok) {
    return [];
  }
  return result.value
    .filter((c) => c.integrationType === provider)
    .map((c) => ({ id: c.id, integrationType: c.integrationType, category: c.categories?.[0] ?? '' }));
};
