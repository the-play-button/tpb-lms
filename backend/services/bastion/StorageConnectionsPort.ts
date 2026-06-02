/**
 * StorageConnectionsPort — bastion `core/connections` BC consumer port
 * for storage-bound connections (tpb-lms).
 *
 * Plan 07 of 2026-06-02_sdk-connections-doctrine-and-entropy-checks/.
 *
 * Naming : intentionally `StorageConnectionsPort` (not `ConnectionsPort`)
 * because tpb-lms specifically consumes storage-flavored connections.
 * Aligns with intention-domain pattern (tpb-storage `StorageTokenResolverPort`).
 */
import type { ConnectionInfo } from '../types/ConnectionInfo.js';

export interface StorageConnectionsPort {
  /** Get ALL storage connections for the user. */
  getAllStorageConnections(jwt: string): Promise<ConnectionInfo[]>;

  /** Get connections filtered by integration type (e.g., 'sharepoint', 'onedrive'). */
  getConnectionsByProvider(jwt: string, provider: string): Promise<ConnectionInfo[]>;

  /** Get user's default storage connection. Throws if no connection configured. */
  getDefaultStorageConnection(jwt: string): Promise<ConnectionInfo>;
}
