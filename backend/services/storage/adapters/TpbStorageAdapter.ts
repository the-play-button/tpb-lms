/**
 * TpbStorageAdapter — thin HTTP wrapper over the tpb-storage Worker.
 *
 * Doctrine CLAUDE.md § API-ready by design + § TPB-SDK PURE HTTP CLIENTS :
 * tpb-storage is the BC that owns Microsoft Graph / Google Drive native
 * adapters (Plan 03 of 2026-05-25_kill-unified-to-runtime-bigbang). The
 * LMS consumes that BC via HTTP using the SDK's `StorageClient` — it never
 * reimplements provider-direct calls itself.
 *
 * Auth path : user's CF Access JWT is forwarded to tpb-storage which resolves
 * the user's per-connection access_token (against bastion D1) and dispatches
 * to the matching native provider (microsoft / google).
 */

import type { StoragePort } from '../StoragePort.js';
import type { StorageFile } from '../../types/StorageFile.js';
import { StorageClient, type StorageFileResponse } from '@the-play-button/tpb-sdk-js';

export interface TpbStorageAdapterConfig {
  storageUrl: string;
  jwt: string;
}

const mapResponse = (r: StorageFileResponse): StorageFile => ({
  id: r.id,
  name: r.name,
  mimeType: r.mime_type ?? (r.type === 'FOLDER' ? 'application/vnd.folder' : 'application/octet-stream'),
  size: r.size,
  parentId: r.parent_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  downloadUrl: r.download_url,
  webUrl: r.web_url,
});

export class TpbStorageAdapter implements StoragePort {
  private readonly client: StorageClient;

  constructor(config: TpbStorageAdapterConfig) {
    this.client = new StorageClient(config.storageUrl, config.jwt);
  }

  /**
   * Eager init — no-op for HTTP client. Kept on the public surface because
   * byocContext awaits it during context construction.
   */
  async initialize(): Promise<void> {
    /* no-op : the HTTP client is stateless and lazy */
  }

  async listFiles(connectionId: string, parentId?: string): Promise<StorageFile[]> {
    const files = await this.client.listFiles(connectionId, parentId);
    return files.map(mapResponse);
  }

  async getFileContent(connectionId: string, fileId: string): Promise<string> {
    const { content } = await this.client.downloadFile(connectionId, fileId);
    return new TextDecoder('utf-8').decode(content);
  }

  async getFileBinary(connectionId: string, fileId: string): Promise<ArrayBuffer> {
    const { content } = await this.client.downloadFile(connectionId, fileId);
    return content;
  }
}
