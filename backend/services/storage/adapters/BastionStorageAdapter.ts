/**
 * BastionStorageAdapter — direct provider (Microsoft Graph / Google Drive v3).
 *
 * Replaces the legacy unified.to passthrough adapter. Resolves the per-connection
 * access_token via bastion (`GET /core/connections/{id}/auth`), then calls the
 * provider API directly.
 *
 * Bastion is the SSOT for connection auth (post 2026-05-27 core-sync drop).
 */

import type { StoragePort } from '../StoragePort.js';
import type { StorageFile } from '../../types/StorageFile.js';
import type { BastionPort } from '../../bastion/BastionPort.js';
import type { ConnectionInfo } from '../../types/ConnectionInfo.js';
import { listFiles as listGraphFiles } from './BastionStorageAdapter.functions/listGraphFiles.js';
import { getGraphFileContent } from './BastionStorageAdapter.functions/getGraphFileContent.js';
import { getGraphFileBinary } from './BastionStorageAdapter.functions/getGraphFileBinary.js';
import { listFiles as listGDriveFiles } from './BastionStorageAdapter.functions/listGDriveFiles.js';
import { getGDriveFileContent } from './BastionStorageAdapter.functions/getGDriveFileContent.js';
import { getGDriveFileBinary } from './BastionStorageAdapter.functions/getGDriveFileBinary.js';

export interface BastionStorageAdapterConfig {
  bastion: BastionPort;
  jwt: string;
}

type Provider = 'microsoft' | 'google';

const PROVIDER_MAP: Record<string, Provider> = {
  microsoftsharepoint: 'microsoft',
  sharepoint: 'microsoft',
  microsoftonedrive: 'microsoft',
  onedrive: 'microsoft',
  microsoft: 'microsoft',
  google: 'google',
  googledrive: 'google',
  gdrive: 'google',
  'google-drive': 'google',
  google_drive: 'google',
};

const resolveProvider = (integrationType: string): Provider => {
  const provider = PROVIDER_MAP[integrationType.toLowerCase()];
  if (!provider) {
    throw new Error(`BastionStorageAdapter: integration '${integrationType}' not supported (microsoft/google only)`);
  }
  return provider;
};

export class BastionStorageAdapter implements StoragePort {
  private readonly bastion: BastionPort;
  private readonly jwt: string;
  private readonly connectionCache = new Map<string, ConnectionInfo>();
  private connectionsResolved = false;

  constructor(config: BastionStorageAdapterConfig) {
    this.bastion = config.bastion;
    this.jwt = config.jwt;
  }

  /**
   * Eager init — pre-fetch all the user's storage connections to populate
   * the provider cache. Kept compatible with the previous adapter's signature
   * so byocContext.initialize() still works.
   */
  async initialize(): Promise<void> {
    await this.loadConnections();
  }

  private async loadConnections(): Promise<void> {
    if (this.connectionsResolved) return;
    const connections = await this.bastion.getAllStorageConnections(this.jwt);
    for (const conn of connections) {
      this.connectionCache.set(conn.id, conn);
    }
    this.connectionsResolved = true;
  }

  private async resolveProviderForConnection(connectionId: string): Promise<Provider> {
    if (!this.connectionCache.has(connectionId)) {
      await this.loadConnections();
    }
    const conn = this.connectionCache.get(connectionId);
    if (!conn) {
      throw new Error(`BastionStorageAdapter: connection ${connectionId} not found in user's storage connections`);
    }
    return resolveProvider(conn.integrationType);
  }

  private async resolveAccessToken(connectionId: string): Promise<string> {
    const auth = await this.bastion.getConnectionAuth(this.jwt, connectionId);
    if (!auth.access_token) {
      throw new Error(`BastionStorageAdapter: connection ${connectionId} has no access_token (re-auth required)`);
    }
    return auth.access_token;
  }

  async listFiles(connectionId: string, parentId?: string): Promise<StorageFile[]> {
    const [provider, accessToken] = await Promise.all([
      this.resolveProviderForConnection(connectionId),
      this.resolveAccessToken(connectionId),
    ]);
    return provider === 'microsoft'
      ? listGraphFiles(accessToken, parentId)
      : listGDriveFiles(accessToken, parentId);
  }

  async getFileContent(connectionId: string, fileId: string): Promise<string> {
    const [provider, accessToken] = await Promise.all([
      this.resolveProviderForConnection(connectionId),
      this.resolveAccessToken(connectionId),
    ]);
    return provider === 'microsoft'
      ? getGraphFileContent(accessToken, fileId)
      : getGDriveFileContent(accessToken, fileId);
  }

  async getFileBinary(connectionId: string, fileId: string): Promise<ArrayBuffer> {
    const [provider, accessToken] = await Promise.all([
      this.resolveProviderForConnection(connectionId),
      this.resolveAccessToken(connectionId),
    ]);
    return provider === 'microsoft'
      ? getGraphFileBinary(accessToken, fileId)
      : getGDriveFileBinary(accessToken, fileId);
  }
}
