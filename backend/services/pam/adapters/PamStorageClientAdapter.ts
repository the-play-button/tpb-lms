/**
 * PAM adapter backed by the tpb-storage BC (Plan 11b.b) — REPLACES PamCloudflareAdapter.
 *
 * The bastion delegated-execute escape-hatch is dead : the KDC no longer runs the storage op (§ SoC).
 * This adapter reads a shared file/folder AS a guest through the tpb-storage BC's OWN delegated-guest
 * endpoints via the SDK `StorageClient` (getFile / listFiles / downloadFile with `{ guestEmail }`).
 * tpb-storage decides access from the resource's own permissions ; the owner's token is resolved inside
 * tpb-storage and never exposed here. The client JWT must carry `storage:delegated:read` (B3-live grant).
 */
import { StorageClient } from '@the-play-button/tpb-sdk-js';
import type { StorageFileResponse } from '@the-play-button/tpb-sdk-js';
import type { PamPort, PamVerifyResult } from '../PamPort.js';
import type { StorageFile } from '../../types/StorageFile.js';
import { ValidationError, NotFoundError, ServiceUnavailableError } from '../../../types/errors.js';

const FOLDER_MIME_TYPE = 'application/vnd.folder';

// Map the SDK snake_case response to the lms camelCase StorageFile. A FOLDER is normalized to the
// canonical folder mime (the path-walk detects folders by `mimeType === FOLDER_MIME_TYPE`).
const toStorageFile = (r: StorageFileResponse): StorageFile => ({
  id: r.id,
  name: r.name,
  mimeType: r.type === 'FOLDER' ? FOLDER_MIME_TYPE : (r.mime_type ?? ''),
  size: r.size,
  parentId: r.parent_id,
  downloadUrl: r.download_url,
  webUrl: r.web_url,
});

// The SDK throws `StorageClient <path>: <status> — <body>` — a 403 (access denied) → boolean, any other
// status (500 / network) re-throws fail-loud (§ ALWAYS FAIL HARD — never mask a real failure).
const isForbidden = (err: unknown): boolean => err instanceof Error && /:\s*403\s/.test(err.message);

export class PamStorageClientAdapter implements PamPort {
  constructor(private readonly storage: StorageClient) {}

  async verifyAccess(connectionId: string, fileId: string, guestEmail: string): Promise<PamVerifyResult> {
    try {
      await this.storage.getFile(connectionId, fileId, { guestEmail });
      return { allowed: true };
    } catch (err) {
      if (isForbidden(err)) return { allowed: false };
      throw err;
    }
  }

  async getContent(connectionId: string, fileId: string, guestEmail: string): Promise<{ content: string }> {
    const { content } = await this.storage.downloadFile(connectionId, fileId, { guestEmail });
    return { content: new TextDecoder().decode(content) };
  }

  async listFiles(connectionId: string, parentId: string, guestEmail: string): Promise<StorageFile[]> {
    const files = await this.storage.listFiles(connectionId, parentId, { guestEmail });
    return files.map(toStorageFile);
  }

  async resolveRelativePath(
    connectionId: string,
    baseFolderId: string,
    relativePath: string,
    guestEmail: string,
  ): Promise<StorageFile> {
    const segments = relativePath.split('/').filter(({ length }) => length > 0);
    if (segments.length === 0) throw new ValidationError('Empty path');

    let currentFolderId = baseFolderId;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;
      const files = await this.listFiles(connectionId, currentFolderId, guestEmail);
      const match = files.find(({ name }) => name === segment);
      if (!match) {
        throw new NotFoundError('Path segment', `${segments.slice(0, i + 1).join('/')} (looking for "${segment}")`);
      }
      if (isLast) return match;
      if (match.mimeType !== FOLDER_MIME_TYPE) {
        throw new ValidationError(`Not a folder: ${segments.slice(0, i + 1).join('/')}`);
      }
      currentFolderId = match.id;
    }
    throw new ServiceUnavailableError('Path resolution', 'Failed');
  }
}
