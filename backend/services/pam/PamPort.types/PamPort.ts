import type { StorageFile } from '../../types/StorageFile.js';
import type { PamVerifyResult } from './PamVerifyResult';

export interface PamPort {
  /**
   * Verify if guest has access via owner's connection
   * Returns authorization result WITHOUT exposing owner's token
   *
   * @param connectionId - Owner's storage connection
   * @param fileId - File to access
   * @param guestEmail - Guest requesting access
   */
  verifyAccess(
    connectionId: string,
    fileId: string,
    guestEmail: string
  ): Promise<PamVerifyResult>;

  /**
   * Get file content via owner's connection
   * Content is streamed through PAM - token never exposed
   *
   * @param connectionId - Owner's storage connection
   * @param fileId - File to read
   * @param guestEmail - Guest requesting access
   */
  getContent(
    connectionId: string,
    fileId: string,
    guestEmail: string
  ): Promise<{ content: string }>;

  /**
   * List files in folder via owner's connection
   *
   * @param connectionId - Owner's storage connection
   * @param parentId - Folder to list
   * @param guestEmail - Guest requesting access
   */
  listFiles(
    connectionId: string,
    parentId: string,
    guestEmail: string
  ): Promise<StorageFile[]>;

  /**
   * Resolve a relative path via PAM (audited access)
   *
   * @param connectionId - Owner's storage connection
   * @param baseFolderId - Starting folder
   * @param relativePath - Path to resolve
   * @param guestEmail - Guest requesting access
   */
  resolveRelativePath(
    connectionId: string,
    baseFolderId: string,
    relativePath: string,
    guestEmail: string
  ): Promise<StorageFile>;
}
