/**
 * ConnectionResolver Port - Interface for multi-tenant connection routing
 *
 * WHY THIS MATTERS:
 * - Decouples business logic from implementation
 * - Enables test mocking without network calls
 * - Allows future provider changes
 *
 * Provides intelligent routing to find the right connection:
 * - Explicit connectionId (direct use)
 * - Provider-based routing with folder access check
 * - Fallback to default connection
 */

import type { ConnectionInfo } from '../types/ConnectionInfo.js';

export interface ResolveConnectionOptions {
  connectionId?: string;
  provider?: string;
  folderId?: string;
}

export interface ConnectionResolverConfig {
  getAllConnections: () => Promise<ConnectionInfo[]>;
  getDefaultConnection: () => Promise<ConnectionInfo>;
  getConnectionsByProvider: (provider: string) => Promise<ConnectionInfo[]>;
  testAccess: (connectionId: string, folderId: string) => Promise<void>;
}

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
