import type { StoragePort } from './StoragePort.js';
import {
  TpbStorageHttpAdapter,
  type TpbStorageHttpAdapterConfig,
} from './adapters/TpbStorageHttpAdapter.js';

/**
 * Factory to create Storage service.
 *
 * Plan 13.b of plans/2026-05-26_exit-unifiedto-runtime-final/ — backed by
 * `TpbStorageHttpAdapter` which forwards to the tpb-storage Worker (native
 * Microsoft Graph / Google Drive adapters), replacing the legacy
 * `UnifiedToStorageAdapter` (api.unified.to direct fetch).
 */
export const createStorageService = (config: TpbStorageHttpAdapterConfig): StoragePort => {
  return new TpbStorageHttpAdapter(config);
};
