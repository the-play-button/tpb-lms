/**
 * Decode Unified.to file ID to get driveId and itemId
 */

import { ValidationError } from '../../types/errors.js';

export const decodeFileId = (fileId: string): { driveId: string; itemId: string } => {
  try {
    const parsed = JSON.parse(atob(fileId));
    return {
      driveId: parsed.d_id || parsed.driveId,
      itemId: parsed.i_id || parsed.itemId,
    };
  } catch {
    const parts = fileId.split(':');
    if (parts.length === 2) {
      return { driveId: parts[0], itemId: parts[1] };
    }
    throw new ValidationError(`Cannot decode fileId: ${fileId}`, { fileId: 'invalid format' });
  }
};
