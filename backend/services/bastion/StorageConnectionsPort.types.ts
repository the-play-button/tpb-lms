import type { ConnectionInfo } from '../types/ConnectionInfo.js';

export interface StorageConnectionsPort {
  /** Get ALL storage connections for the user. */
  getAllStorageConnections(jwt: string): Promise<ConnectionInfo[]>;

  /** Get connections filtered by integration type (e.g., 'sharepoint', 'onedrive'). */
  getConnectionsByProvider(jwt: string, provider: string): Promise<ConnectionInfo[]>;

  /** Get user's default storage connection. Throws if no connection configured. */
  getDefaultStorageConnection(jwt: string): Promise<ConnectionInfo>;
}
