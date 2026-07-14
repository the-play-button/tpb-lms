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

import type { StorageConnectionsPort } from './StorageConnectionsPort.types';
export type { StorageConnectionsPort };


