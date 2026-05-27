/**
 * Storage Service — File Storage Operations
 *
 * USAGE: // entropy-single-use-variables-ok: storage/index — JSDoc USAGE block shows storage adapter consumption pattern (SDK consumer reference)
 * const storage = createStorageService({ tpbStorageUrl: env.TPB_STORAGE_URL, bastionToken: env.BASTION_TOKEN });
 * const content = await storage.getFileContent(connectionId, fileId);
 */

export type { StoragePort } from './StoragePort.js';

export { TpbStorageHttpAdapter } from './adapters/TpbStorageHttpAdapter.js';
export type { TpbStorageHttpAdapterConfig } from './adapters/TpbStorageHttpAdapter.js';

export { createStorageService } from './createStorageService.js';
