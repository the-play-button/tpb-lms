import type { StorageFile } from '../../../types/StorageFile.js';

/**
 * Map Unified.to API response to StorageFile
 *
 * Normalizes the raw API response into our canonical StorageFile shape.
 * Handles missing fields gracefully with sensible defaults.
 */
export const mapFile = (data: Record<string, unknown>): StorageFile => {
  const isFolder = Boolean(data.type === 'folder' || data.is_folder);

  return {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    mimeType: isFolder
      ? 'application/vnd.folder'
      : String(data.mime_type ?? 'application/octet-stream'),
    size: data.size != null ? Number(data.size) : undefined,
    parentId: data.parent_id != null ? String(data.parent_id) : undefined,
    createdAt: data.created_at != null ? String(data.created_at) : undefined,
    updatedAt: data.updated_at != null ? String(data.updated_at) : undefined,
    downloadUrl: data.download_url != null ? String(data.download_url) : undefined,
    webUrl: data.web_url != null ? String(data.web_url) : undefined,
  };
};
