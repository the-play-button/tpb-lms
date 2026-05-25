/**
 * Filter — Régime B : PIPELINE_STEP_PASS_THROUGH (no FLS — endpoint scope-restricted via CheckPolicies).
 */
import type { ConnectionInfo } from '../../../../services/types/ConnectionInfo.js';

export const listConnectionsFilter = (connections: ConnectionInfo[]): ConnectionInfo[] => {
  return connections;
};
