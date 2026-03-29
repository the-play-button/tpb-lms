import type { StorageFile } from '../../../types/StorageFile.js';
import { ValidationError, NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import { listFiles } from './listFiles.js';

const FOLDER_MIME_TYPE = 'application/vnd.folder';

/**
 * Resolve a relative path by walking folder segments via PAM
 *
 * Walks each path segment by listing folder contents and matching by name.
 * Uses PAM delegated access so owner tokens are never exposed.
 */
export async function resolveRelativePath(
  bastionUrl: string,
  getToken: () => string,
  connectionId: string,
  baseFolderId: string,
  relativePath: string,
  guestEmail: string
): Promise<StorageFile> {
  const segments = relativePath.split('/').filter(s => s.length > 0);

  if (segments.length === 0) {
    throw new ValidationError('Empty path');
  }

  let currentFolderId = baseFolderId;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;

    const files = await listFiles(bastionUrl, getToken, connectionId, currentFolderId, guestEmail);
    const match = files.find(f => f.name === segment);

    if (!match) {
      throw new NotFoundError('Path segment', `${segments.slice(0, i + 1).join('/')} (looking for "${segment}")`);
    }

    if (isLast) {
      return match;
    } else {
      if (match.mimeType !== FOLDER_MIME_TYPE) {
        throw new ValidationError(`Not a folder: ${segments.slice(0, i + 1).join('/')}`);
      }
      currentFolderId = match.id;
    }
  }

  throw new ServiceUnavailableError('Path resolution', 'Failed');
}
