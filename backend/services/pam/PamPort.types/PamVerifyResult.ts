import type { StorageFile } from '../../types/StorageFile.js';

export interface PamVerifyResult {
  allowed: boolean;
  owner?: { email: string };
}
