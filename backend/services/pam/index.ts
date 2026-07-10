/**
 * PAM Service — Privileged Access Management.
 *
 * Guest reads go through the tpb-storage BC (Plan 11b.b) via `PamStorageClientAdapter`, wired in
 * `byocContext` with an SDK `StorageClient`. The bastion delegated-execute escape-hatch is dead.
 */
export type { PamPort, PamVerifyResult } from './PamPort.js';
export { PamStorageClientAdapter } from './adapters/PamStorageClientAdapter.js';
