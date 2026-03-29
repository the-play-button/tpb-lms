import type { ConnectionInfo } from '../../../types/ConnectionInfo.js';
import { bastionFetch } from './bastionFetch.js';

export async function getAllStorageConnections(bastionUrl: string, jwt: string): Promise<ConnectionInfo[]> {
  const response = await bastionFetch(bastionUrl, '/core/connections/me?category=storage', jwt);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { connections: ConnectionInfo[] };
  return data.connections || [];
}
