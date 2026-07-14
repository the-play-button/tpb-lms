import type { ConnectionInfo } from '../../types/ConnectionInfo.js';
import type { ResolveConnectionOptions } from './ResolveConnectionOptions';

export interface ConnectionResolverPort {
  /**
   * Find a working connection for the given provider and folder.
   * Tries each connection until one succeeds (multi-tenant support).
   *
   * @param provider - Integration type (e.g., 'sharepoint', 'onedrive')
   * @param folderId - Folder to access
   */
  findWorkingConnection(provider: string, folderId: string): Promise<ConnectionInfo>;

  /**
   * Get the appropriate connection based on request parameters.
   * Priority: connectionId > provider (with routing) > default
   *
   * @param params - Resolution options
   */
  resolveConnection(params: ResolveConnectionOptions): Promise<ConnectionInfo>;

  /**
   * Get all user's storage connections
   */
  getAllConnections(): Promise<ConnectionInfo[]>;

  /**
   * Get user's default storage connection
   * @throws if no default connection is configured
   */
  getDefaultConnection(): Promise<ConnectionInfo>;
}
