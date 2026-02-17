import type { IFetcher } from '../../../types/IFetcher.js';
import type { ConnectionInfo } from '../../../types/ConnectionInfo.js';
import { bastionFetch } from './bastionFetch.js';

export async function getConnectionsByProvider(fetcher: IFetcher, jwt: string, provider: string): Promise<ConnectionInfo[]> {
  const response = await bastionFetch(fetcher, `/core/connections/me?integrationType=${provider}`, jwt);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { connections: ConnectionInfo[] };
  return data.connections || [];
}
