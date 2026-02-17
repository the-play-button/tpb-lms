/**
 * ConnectionResolver Adapter - Production implementation
 *
 * Multi-tenant connection routing adapted for LMS hybrid model:
 * - Explicit connectionId (direct use)
 * - Provider-based routing with folder access check
 * - Fallback to default connection (admin TPB)
 */

import type { ConnectionResolverPort, ConnectionResolverConfig, ResolveConnectionOptions } from '../ConnectionResolverPort.js';
import type { ConnectionInfo } from '../../types/ConnectionInfo.js';
import { testAccess } from './ConnectionResolverAdapter.functions/testAccess.js';
import { findWorkingConnection } from './ConnectionResolverAdapter.functions/findWorkingConnection.js';
import { resolveConnection } from './ConnectionResolverAdapter.functions/resolveConnection.js';

export class ConnectionResolverAdapter implements ConnectionResolverPort {
  private config: ConnectionResolverConfig;

  constructor(config: ConnectionResolverConfig) {
    this.config = config;
  }

  private async testAccess(connectionId: string, folderId: string): Promise<void> {
    return testAccess(this.config, connectionId, folderId);
  }

  async findWorkingConnection(provider: string, folderId: string): Promise<ConnectionInfo> {
    return findWorkingConnection(this.config, provider, folderId);
  }

  async resolveConnection(params: ResolveConnectionOptions): Promise<ConnectionInfo> {
    return resolveConnection(this.config, params);
  }

  async getAllConnections(): Promise<ConnectionInfo[]> {
    return this.config.getAllConnections();
  }

  async getDefaultConnection(): Promise<ConnectionInfo> {
    return this.config.getDefaultConnection();
  }
}
