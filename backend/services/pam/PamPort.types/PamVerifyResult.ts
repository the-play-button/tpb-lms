import type { StorageFile } from '../../types/StorageFile.types.js';

export interface PamVerifyResult {
  allowed: boolean;
  owner?: { email: string };
}
