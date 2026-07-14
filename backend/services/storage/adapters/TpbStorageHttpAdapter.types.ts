import type { StoragePort } from '../StoragePort.js';
import type { StorageFile } from '../../types/StorageFile.js';

export interface TpbStorageHttpAdapterConfig {
  tpbStorageUrl: string;
  bastionToken: string;
}
