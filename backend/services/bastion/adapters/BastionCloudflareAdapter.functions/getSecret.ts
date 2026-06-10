import { bastionFetch } from './bastionFetch.js';
import { ServiceUnavailableError } from '../../../../types/errors.js';

export const getSecret = async (bastionUrl: string, jwt: string, path: string): Promise<string | null> => {
  const response = await bastionFetch(bastionUrl, `/vault/secrets/by-path/${path}`, jwt);
  if (!response.ok) {
    throw new ServiceUnavailableError('bastion', `Secret fetch failed for '${path}': HTTP ${response.status}`);
  }
  const data = (await response.json()) as { data?: { value?: string } };
  return data.data?.value || null;
};
