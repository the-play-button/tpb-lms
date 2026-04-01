import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';

/**
 * Filter step: pass-through for connection listings.
 * Connections are scoped to the authenticated user — no FLS needed.
 */
export const listConnectionsFilter = (output: ConnectionInfo[]): ConnectionInfo[] => {
  return output;
};
