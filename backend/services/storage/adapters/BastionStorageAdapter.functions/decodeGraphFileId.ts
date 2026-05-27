/**
 * Decode a TPB-encoded MS Graph file identifier.
 *
 * Supported formats (in order):
 *   1. Base64 JSON: { driveId, id } — canonical TPB encoding.
 *   2. `driveId:itemId` — colon-separated fallback.
 *   3. Plain item id — driveId resolved by caller (typically `/me/drive`).
 */
export interface DecodedGraphFileId {
  drive_id: string | null;
  item_id: string;
}

export const decodeGraphFileId = (fileId: string): DecodedGraphFileId => {
  try {
    const decoded = JSON.parse(atob(fileId)) as { driveId?: string; id?: string };
    if (decoded.driveId && decoded.id) {
      return { drive_id: decoded.driveId, item_id: decoded.id };
    }
  } catch {
    // fall through to other formats
  }
  if (fileId.includes(':')) {
    const [drive_id, item_id] = fileId.split(':', 2);
    return { drive_id, item_id };
  }
  return { drive_id: null, item_id: fileId };
};

export const graphDrivePath = (drive_id: string | null): string =>
  drive_id ? `/drives/${drive_id}` : '/me/drive';
