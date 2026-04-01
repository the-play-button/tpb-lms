/**
 * Storage Service - File Storage Operations
 *
 * USAGE:
 * const storage = createStorageService({ getApiToken: async () => env.UNIFIED_API_TOKEN });
 * const content = await storage.getFileContent(connectionId, fileId);
 */

export type { StoragePort } from './StoragePort.js';

export { UnifiedToStorageAdapter } from './adapters/UnifiedToStorageAdapter.js';
export type { UnifiedToStorageAdapterConfig } from './adapters/UnifiedToStorageAdapter.js';

export { createStorageService } from './createStorageService.js';
