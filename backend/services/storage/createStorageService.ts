import type { StoragePort } from './StoragePort.js';
import { BastionStorageAdapter, type BastionStorageAdapterConfig } from './adapters/BastionStorageAdapter.js';

/**
 * Factory to create Storage service.
 *
 * Native provider dispatch (Microsoft Graph / Google Drive v3) — replaces the
 * unified.to passthrough wrapper since 2026-05-27. Per-connection OAuth token
 * resolved from bastion D1 mirror (SSOT).
 */
export const createStorageService = (config: BastionStorageAdapterConfig): StoragePort => {
  return new BastionStorageAdapter(config);
};
