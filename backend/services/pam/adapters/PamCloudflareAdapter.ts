/**
 * PAM HTTP Adapter - Production implementation
 *
 * Connects to TPB PAM via HTTP.
 * Provides secure delegated access to storage via owner's connection.
 * Owner's token is NEVER exposed - all access goes through PAM.
 */

import type { PamPort, PamConfig, PamVerifyResult } from '../PamPort.js';
import type { StorageFile } from '../../types/StorageFile.js';
import { ServiceUnavailableError } from '../../../types/errors.js';
import { pamFetch } from './PamCloudflareAdapter.functions/pamFetch.js';
import { verifyAccess } from './PamCloudflareAdapter.functions/verifyAccess.js';
import { listFiles } from './PamCloudflareAdapter.functions/listFiles.js';
import { resolveRelativePath } from './PamCloudflareAdapter.functions/resolveRelativePath.js';

export class PamCloudflareAdapter implements PamPort {
  private bastionUrl: string;
  private getToken: () => string;

  constructor(config: PamConfig) {
    this.bastionUrl = config.bastionUrl;
    this.getToken = config.getToken;
  }

  async verifyAccess(
    connectionId: string,
    fileId: string,
    guestEmail: string
  ): Promise<PamVerifyResult> {
    return verifyAccess(this.bastionUrl, this.getToken, connectionId, fileId, guestEmail);
  }

  async getContent(
    connectionId: string,
    fileId: string,
    guestEmail: string
  ): Promise<{ content: string }> {
    const response = await pamFetch(this.bastionUrl, this.getToken, 'storage', 'file', 'read', {
      connectionId,
      entityId: fileId,
      guestEmail,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableError('PAM content', `${response.status} - ${text}`);
    }

    return response.json() as Promise<{ content: string }>;
  }

  async listFiles(
    connectionId: string,
    parentId: string,
    guestEmail: string
  ): Promise<StorageFile[]> {
    return listFiles(this.bastionUrl, this.getToken, connectionId, parentId, guestEmail);
  }

  async resolveRelativePath(
    connectionId: string,
    baseFolderId: string,
    relativePath: string,
    guestEmail: string
  ): Promise<StorageFile> {
    return resolveRelativePath(this.bastionUrl, this.getToken, connectionId, baseFolderId, relativePath, guestEmail);
  }
}
