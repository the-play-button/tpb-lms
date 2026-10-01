import type { StoragePort } from './StoragePort.js';
import {
  TpbStorageHttpAdapter,
  type TpbStorageHttpAdapterConfig,
} from './adapters/TpbStorageHttpAdapter.js';

/**
 * Factory to create Storage service.
 *
 * Plan 13.b of the direct-HTTP-client migration (2026-05-26) — backed by
 * `TpbStorageHttpAdapter` which forwards to the tpb-storage Worker (native
 * Microsoft Graph / Google Drive adapters).
 */
export const createStorageService = (config: TpbStorageHttpAdapterConfig): StoragePort => {
  return new TpbStorageHttpAdapter(config);
};
