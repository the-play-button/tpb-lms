/**
 * PAM Port - Interface for Privileged Access Management operations
 *
 * WHY THIS MATTERS:
 * - Decouples business logic from implementation
 * - Enables test mocking without network calls
 * - Allows future provider changes
 *
 * Provides secure delegated access to storage via owner's connection.
 * Owner's token is NEVER exposed - all access goes through PAM.
 */

import type { StorageFile } from '../types/StorageFile.js';

export interface PamVerifyResult {
  allowed: boolean;
  owner?: { email: string };
}

export interface PamConfig {
  bastionUrl: string;
  getToken: () => string;
}

/**
 * PAM Port interface
 *
 * Provides:
 * - Guest access verification
 * - Delegated file content retrieval
 * - Delegated file listing
 * - Path resolution via owner's connection
 */
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
