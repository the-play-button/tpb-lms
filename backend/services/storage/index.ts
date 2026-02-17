/**
 * Storage Service - File Storage Operations
 *
 * USAGE:
 * const storage = createStorageService({ getApiToken: async () => env.UNIFIED_API_TOKEN });
 * const content = await storage.getFileContent(connectionId, fileId);
 */

// Port types
export type { StoragePort } from './StoragePort.js';

// Adapters
export { UnifiedStorageAdapter } from './adapters/UnifiedStorageAdapter.js';
export type { UnifiedStorageAdapterConfig } from './adapters/UnifiedStorageAdapter.js';

import type { StoragePort } from './StoragePort.js';
import { UnifiedStorageAdapter, type UnifiedStorageAdapterConfig } from './adapters/UnifiedStorageAdapter.js';

/**
 * Factory to create Storage service
 *
 * @param config - Configuration with token provider
 */
export function createStorageService(config: UnifiedStorageAdapterConfig): StoragePort {
  return new UnifiedStorageAdapter(config);
}
