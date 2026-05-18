/**
 * Filter — Régime B : pass-through (no FLS — endpoint scope-restricted via CheckPolicies).
 */
import type { ConnectionInfo } from '../../../services/types/ConnectionInfo.js';

/**
 * Filter step: pass-through for default connection.
 * Connections are scoped to the authenticated user — no FLS needed.
 */
export const getDefaultConnectionFilter = (output: ConnectionInfo): ConnectionInfo => {
  return output;
};
