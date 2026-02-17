/**
 * Decode Unified.to file ID to get driveId and itemId
 */

import { ValidationError } from '../../types/errors.js';

export function decodeFileId(fileId: string): { driveId: string; itemId: string } {
  try {
    const decoded = atob(fileId);
    const parsed = JSON.parse(decoded);
    return {
      driveId: parsed.d_id || parsed.driveId,
      itemId: parsed.i_id || parsed.itemId,
    };
  } catch {
    // Try format "driveId:itemId"
    const parts = fileId.split(':');
    if (parts.length === 2) {
      return { driveId: parts[0], itemId: parts[1] };
    }
    throw new ValidationError(`Cannot decode fileId: ${fileId}`, { fileId: 'invalid format' });
  }
}
