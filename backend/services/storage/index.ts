/**
 * Storage Service - File Storage Operations
 *
 * USAGE: // entropy-single-use-variables-ok: storage/index — JSDoc USAGE block shows storage adapter consumption pattern (SDK consumer reference)
 * const storage = createStorageService({ bastion, jwt });
 * const content = await storage.getFileContent(connectionId, fileId);
 */

export type { StoragePort } from './StoragePort.js';

export { BastionStorageAdapter } from './adapters/BastionStorageAdapter.js';
export type { BastionStorageAdapterConfig } from './adapters/BastionStorageAdapter.js';

export { createStorageService } from './createStorageService.js';
