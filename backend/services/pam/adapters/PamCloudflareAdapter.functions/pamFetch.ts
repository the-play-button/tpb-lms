// entropy-subfolders-pattern-ok: structure is intentional

/**
 * Make a delegated PAM API request via HTTP
 *
 * @param bastionUrl - Bastion URL for HTTP calls
 * @param getToken - Token provider for authorization
 * @param domain - PAM domain (e.g. 'storage')
 * @param entity - PAM entity (e.g. 'file', 'folder')
 * @param operation - PAM operation (e.g. 'verify', 'read', 'list')
 * @param body - Request payload
 */
export const pamFetch = async (
  bastionUrl: string,
  getToken: () => string,
  domain: string,
  entity: string,
  operation: string,
  body: unknown
): Promise<Response> => {
  const token = getToken();
  return fetch(`${bastionUrl}/pam/delegated/${domain}/${entity}/${operation}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};
