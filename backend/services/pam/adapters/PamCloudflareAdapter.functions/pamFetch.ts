import type { IFetcher } from '../../../types/IFetcher.js';

/**
 * Make a delegated PAM API request via Cloudflare Service Binding
 *
 * @param fetcher - Service binding to bastion worker
 * @param getToken - Token provider for authorization
 * @param domain - PAM domain (e.g. 'storage')
 * @param entity - PAM entity (e.g. 'file', 'folder')
 * @param operation - PAM operation (e.g. 'verify', 'read', 'list')
 * @param body - Request payload
 */
export async function pamFetch(
  fetcher: IFetcher,
  getToken: () => string,
  domain: string,
  entity: string,
  operation: string,
  body: unknown
): Promise<Response> {
  const token = getToken();
  return fetcher.fetch(
    new Request(`https://bastion/pam/delegated/${domain}/${entity}/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  );
}
