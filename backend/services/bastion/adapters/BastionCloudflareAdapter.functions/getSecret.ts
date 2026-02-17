import type { IFetcher } from '../../../types/IFetcher.js';
import { bastionFetch } from './bastionFetch.js';

export async function getSecret(fetcher: IFetcher, jwt: string, path: string): Promise<string | null> {
  const response = await bastionFetch(fetcher, `/secret/data/${path}`, jwt);
  if (!response.ok) return null;
  const data = (await response.json()) as { data?: { value?: string } };
  return data.data?.value || null;
}
