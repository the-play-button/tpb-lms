/**
 * TpbStorageHttpAdapter — `StoragePort` impl that forwards to the tpb-storage
 * Worker (native Microsoft Graph / Google Drive adapters).
 *
 * Plan 13.b of plans/2026-05-26_exit-unifiedto-runtime-final/. Worker-to-Worker
 * HTTP forward to tpb-storage : the bastion-issued service token authenticates
 * the call ; the tpb-storage Worker resolves the connection's OAuth token
 * natively via BastionTokenResolver and dispatches to the matching provider.
 */

import type { StoragePort } from '../StoragePort.js';
import type { StorageFile } from '../../types/StorageFile.js';

import type { TpbStorageHttpAdapterConfig } from './TpbStorageHttpAdapter.types';
export type { TpbStorageHttpAdapterConfig };


// Note: `listFiles` is not part of StoragePort but is exposed by the prior
// adapter for ConnectionResolverAdapter.testAccess. Kept here to preserve the
// public contract.


interface TpbStorageFileResponse {
  id?: string;
  name?: string;
  type?: 'FILE' | 'FOLDER';
  parent_id?: string;
  mime_type?: string;
  size?: number;
  web_url?: string;
  updated_at?: string;
}

interface TpbStorageListResponse {
  files?: TpbStorageFileResponse[];
}

interface TpbStorageDownloadResponse {
  content: string;
  mime_type?: string;
}

export class TpbStorageHttpAdapter implements StoragePort {
  constructor(private readonly config: TpbStorageHttpAdapterConfig) {}

  private async fetchStorage(path: string, params: Record<string, string | undefined>, label: string): Promise<Response> {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) usp.set(k, v);
    }
    const url = `${this.config.tpbStorageUrl}${path}?${usp.toString()}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.bastionToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`tpb-storage ${label} failed: ${resp.status} ${text.slice(0, 200)}`);
    }
    return resp;
  }

  async listFiles(connectionId: string, parentId?: string): Promise<StorageFile[]> {
    const resp = await this.fetchStorage('/api/storage/list', { connectionId, parent_id: parentId }, 'list');
    const body = (await resp.json()) as TpbStorageListResponse;
    return (body.files ?? []).map((f) => ({
      id: String(f.id ?? ''),
      name: String(f.name ?? ''),
      mimeType: String(f.mime_type ?? ''),
      size: f.size,
      parentId: f.parent_id,
      updatedAt: f.updated_at,
      webUrl: f.web_url,
    }));
  }

  async getFileContent(connectionId: string, fileId: string): Promise<string> {
    const resp = await this.fetchStorage('/api/storage/file', { connectionId, fileId }, 'download');
    const body = (await resp.json()) as TpbStorageDownloadResponse;
    return body.content;
  }

  async getFileBinary(connectionId: string, fileId: string): Promise<ArrayBuffer> {
    const resp = await this.fetchStorage('/api/storage/file', { connectionId, fileId }, 'binary fetch');
    return resp.arrayBuffer();
  }
}
