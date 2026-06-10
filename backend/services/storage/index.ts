/**
 * Storage Service — File Storage Operations
 *
 * USAGE:
 * const storage = createStorageService({ tpbStorageUrl: env.TPB_STORAGE_URL, bastionToken: env.BASTION_TOKEN });
 * const content = await storage.getFileContent(connectionId, fileId);
 */

export type { StoragePort } from './StoragePort.js';

export { TpbStorageHttpAdapter } from './adapters/TpbStorageHttpAdapter.js';
export type { TpbStorageHttpAdapterConfig } from './adapters/TpbStorageHttpAdapter.js';

export { createStorageService } from './createStorageService.js';
