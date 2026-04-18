// entropy-positional-args-excess-ok: handler exports (getFile) use CF Worker positional convention (request, env, ctx)
import type { StorageFile } from '../../../types/StorageFile.js';
import { request } from './request.js';
import { mapFile } from './mapFile.js';

/**
 * Get file metadata by ID via Unified.to storage API
 *
 * @param accessToken - Unified.to API token
 * @param connectionId - Storage connection ID
 * @param fileId - File to retrieve
 */
export const getFile = async (accessToken: string, connectionId: string, fileId: string): Promise<StorageFile> => {
  const data = await request<Record<string, unknown>>(
    accessToken,
    connectionId,
    'GET',
    `/storage/v1/connection/${connectionId}/file/${fileId}`
  );

  return mapFile(data);
};
