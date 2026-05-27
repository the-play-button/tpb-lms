/**
 * Storage Service - File Storage Operations
 *
 * USAGE: // entropy-single-use-variables-ok: storage/index — JSDoc USAGE block shows storage adapter consumption pattern (SDK consumer reference)
 * const storage = createStorageService({ storageUrl: env.STORAGE_URL, jwt });
 * const content = await storage.getFileContent(connectionId, fileId);
 */

export type { StoragePort } from './StoragePort.js';

export { TpbStorageAdapter } from './adapters/TpbStorageAdapter.js';
export type { TpbStorageAdapterConfig } from './adapters/TpbStorageAdapter.js';

export { createStorageService } from './createStorageService.js';
