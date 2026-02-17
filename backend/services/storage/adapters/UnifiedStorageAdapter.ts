// entropy-multiple-exports-ok: cohesive module exports
// entropy-class-method-length-ok: UnifiedStorageAdapter — lazy token resolution + listFiles/getFileContent/getFileBinary all coupled by shared accessToken and Unified.to API
/**
 * Unified Storage Adapter - Production implementation via Unified.to
 *
 * Provides direct storage access using the Unified.to API.
 * Used by content owners/admins who have their own connection credentials.
 */

import type { StoragePort } from '../StoragePort.js';
import type { StorageFile } from '../../types/StorageFile.js';
import { request } from './UnifiedStorageAdapter.functions/request.js';
import { downloadFile } from './UnifiedStorageAdapter.functions/downloadFile.js';
import { listFiles as listFilesRaw } from './UnifiedStorageAdapter.functions/listFiles.js';

export interface UnifiedStorageAdapterConfig {
  getApiToken: () => Promise<string>;
}

export class UnifiedStorageAdapter implements StoragePort {
  private config: UnifiedStorageAdapterConfig;
  private accessToken: string | null = null;

  constructor(config: UnifiedStorageAdapterConfig) {
    this.config = config;
  }

  /**
   * Resolve the API token lazily
   */
  private async getToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await this.config.getApiToken();
    }
    return this.accessToken;
  }

  /**
   * Eagerly resolve the API token
   *
   * Not part of StoragePort -- used by byocContext for eager init.
   */
  async initialize(): Promise<void> {
    this.accessToken = await this.config.getApiToken();
  }

  /**
   * List files in a folder
   *
   * Not part of StoragePort -- used by connection resolver for access testing.
   */
  async listFiles(connectionId: string, parentId?: string): Promise<StorageFile[]> {
    const token = await this.getToken();
    return listFilesRaw(token, connectionId, parentId);
  }

  async getFileContent(connectionId: string, fileId: string): Promise<string> {
    const token = await this.getToken();
    const data = await request<{ content: string }>(
      token,
      connectionId,
      'GET',
      `/storage/v1/connection/${connectionId}/file/${fileId}`
    );
    return data.content;
  }

  async getFileBinary(connectionId: string, fileId: string): Promise<ArrayBuffer> {
    const token = await this.getToken();
    const { content } = await downloadFile(token, connectionId, fileId);
    return content;
  }
}
