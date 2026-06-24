/**
 * Intersection alias of bastion-backed ports used by tpb-lms HandlerContext.
 *
 * Plan 07 of 2026-06-02_sdk-connections-doctrine-and-entropy-checks/ :
 * the god-port `BastionDependencies` has been split into BC-aligned ports
 * (`VaultPort`, `StorageConnectionsPort`). This file is now a thin
 * intersection alias to preserve the single-injection point in
 * HandlerContext while satisfying the entropy doctrine via re-exports.
 *
 * Future refacto : inject only the ports each use case needs.
 */
import type { VaultPort, BastionConfig } from './VaultPort.js';
import type { StorageConnectionsPort } from './StorageConnectionsPort.js';

export type BastionDependencies = VaultPort & StorageConnectionsPort;
export type { VaultPort, BastionConfig, StorageConnectionsPort };
