import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';

/**
 * Filter step: pass-through for connection listings.
 * Connections are scoped to the authenticated user — no FLS needed.
 */
export const listConnectionsFilter = (connections: ConnectionInfo[]): ConnectionInfo[] => {
  return connections;
};
