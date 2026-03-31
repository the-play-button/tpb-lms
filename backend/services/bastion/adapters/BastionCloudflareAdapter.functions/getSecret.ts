// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
import { bastionFetch } from './bastionFetch.js';

export const getSecret = async (bastionUrl: string, jwt: string, path: string): Promise<string | null> => {
  const response = await bastionFetch(bastionUrl, `/secret/data/${path}`, jwt);
  if (!response.ok) return null;
  const data = (await response.json()) as { data?: { value?: string } };
  return data.data?.value || null;
};
