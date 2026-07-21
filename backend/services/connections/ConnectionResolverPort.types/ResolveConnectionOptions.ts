import type { ConnectionInfo } from '../../types/ConnectionInfo.types.js';

export interface ResolveConnectionOptions {
  connectionId?: string;
  provider?: string;
  folderId?: string;
}
