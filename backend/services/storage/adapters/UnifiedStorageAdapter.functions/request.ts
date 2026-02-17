import { ServiceUnavailableError } from '../../../../types/errors.js';

const UNIFIED_API = 'https://api.unified.to';

/**
 * Generic Unified.to API request helper
 *
 * Handles authorization, content-type, and error mapping for all
 * Unified.to storage API calls.
 *
 * @param accessToken - Unified.to API token
 * @param connectionId - Storage connection ID
 * @param method - HTTP method
 * @param path - API path (appended to base URL)
 * @param body - Optional request body
 * @param signal - Optional abort signal
 */
export async function request<T>(
  accessToken: string,
  connectionId: string,
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${UNIFIED_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-connection-id': connectionId,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    throw new ServiceUnavailableError('Storage', `Status ${response.status}`);
  }

  return response.json();
}
