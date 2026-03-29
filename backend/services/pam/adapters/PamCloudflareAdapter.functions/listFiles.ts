import type { StorageFile } from '../../../types/StorageFile.js';
import { ServiceUnavailableError } from '../../../../types/errors.js';
import { pamFetch } from './pamFetch.js';

/**
 * List files in a folder via PAM delegated access
 */
export async function listFiles(
  bastionUrl: string,
  getToken: () => string,
  connectionId: string,
  parentId: string,
  guestEmail: string
): Promise<StorageFile[]> {
  const response = await pamFetch(bastionUrl, getToken, 'storage', 'folder', 'list', {
    connectionId,
    entityId: parentId,
    guestEmail,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ServiceUnavailableError('PAM list', `${response.status} - ${text}`);
  }

  const data = await response.json() as { items: StorageFile[] };
  return data.items || [];
}
