import type { ConnectionInfo } from '../../../types/ConnectionInfo.js';
import { bastionFetch } from './bastionFetch.js';

export async function getConnectionsByProvider(bastionUrl: string, jwt: string, provider: string): Promise<ConnectionInfo[]> {
  const response = await bastionFetch(bastionUrl, `/core/connections/me?integrationType=${provider}`, jwt);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { connections: ConnectionInfo[] };
  return data.connections || [];
}
