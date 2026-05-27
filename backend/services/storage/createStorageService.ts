import type { StoragePort } from './StoragePort.js';
import { TpbStorageAdapter, type TpbStorageAdapterConfig } from './adapters/TpbStorageAdapter.js';

/**
 * Factory for the Storage service.
 *
 * tpb-storage Worker (the BC owning Microsoft Graph / Google Drive native
 * adapters) is consumed over HTTP via the SDK's `StorageClient`. The LMS does
 * not reimplement provider-direct calls — doctrine § API-ready by design.
 */
export const createStorageService = (config: TpbStorageAdapterConfig): StoragePort => {
  return new TpbStorageAdapter(config);
};
