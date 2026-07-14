import type { ConnectionInfo } from '../../types/ConnectionInfo.js';

export interface ConnectionResolverConfig {
  getAllConnections: () => Promise<ConnectionInfo[]>;
  getDefaultConnection: () => Promise<ConnectionInfo>;
  getConnectionsByProvider: (provider: string) => Promise<ConnectionInfo[]>;
  testAccess: (connectionId: string, folderId: string) => Promise<void>;
}
