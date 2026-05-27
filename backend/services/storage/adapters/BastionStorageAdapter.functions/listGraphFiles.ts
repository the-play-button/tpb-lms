import type { StorageFile } from '../../../types/StorageFile.js';
import { ServiceUnavailableError } from '../../../../types/errors.js';
import { decodeGraphFileId, graphDrivePath } from './decodeGraphFileId.js';
import { mapGraphItemToStorageFile } from './mapGraphItem.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

interface GraphChildrenResponse {
  value: unknown[];
  '@odata.nextLink'?: string;
}

export const listFiles = async (accessToken: string, parentId?: string): Promise<StorageFile[]> => {
  let path: string;
  if (parentId) {
    const { drive_id, item_id } = decodeGraphFileId(parentId);
    path = `${graphDrivePath(drive_id)}/items/${encodeURIComponent(item_id)}/children`;
  } else {
    path = '/me/drive/root/children';
  }

  const response = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ServiceUnavailableError('Storage', `MS Graph listFiles ${response.status}`);
  }
  const data = (await response.json()) as GraphChildrenResponse;
  const items = (data.value as Parameters<typeof mapGraphItemToStorageFile>[0][]) ?? [];
  return items.map(mapGraphItemToStorageFile);
};
