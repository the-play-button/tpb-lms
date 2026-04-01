import type { StoragePort } from './StoragePort.js';
import {
  UnifiedToStorageAdapter,
  type UnifiedToStorageAdapterConfig,
} from './adapters/UnifiedToStorageAdapter.js';

/**
 * Factory to create Storage service
 *
 * @param config - Configuration with token provider
 */
export const createStorageService = (config: UnifiedToStorageAdapterConfig): StoragePort => {
  return new UnifiedToStorageAdapter(config);
};
