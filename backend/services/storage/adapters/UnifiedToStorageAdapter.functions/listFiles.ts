// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
import type { StorageFile } from '../../../types/StorageFile.js';
import { request } from './request.js';
import { mapFile } from './mapFile.js';

/**
 * List files in a folder via Unified.to storage API
 *
 * @param accessToken - Unified.to API token
 * @param connectionId - Storage connection ID
 * @param parentId - Parent folder ID (omit for root)
 */
export const listFiles = async (accessToken: string, connectionId: string, parentId?: string): Promise<StorageFile[]> => {
  const params = new URLSearchParams();
  if (parentId) params.set('parent_id', parentId);

  const query = params.toString();
  const path = `/storage/v1/connection/${connectionId}/file${query ? `?${query}` : ''}`;

  const data = await request<Array<Record<string, unknown>>>(
    accessToken,
    connectionId,
    'GET',
    path
  );

  return (Array.isArray(data) ? data : []).map(mapFile);
};
