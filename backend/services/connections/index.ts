/**
 * ConnectionResolver Service - Multi-tenant connection routing
 *
 * USAGE:
 * const resolver = createConnectionResolver({ ... });
 * const conn = await resolver.resolveConnection({ provider: 'onedrive', folderId });
 */

export type {
  ConnectionResolverPort,
  ConnectionResolverConfig,
  ResolveConnectionOptions,
} from './ConnectionResolverPort.js';

export { ConnectionResolverAdapter } from './adapters/ConnectionResolverAdapter.js';

import type { ConnectionResolverPort, ConnectionResolverConfig } from './ConnectionResolverPort.js';
import { ConnectionResolverAdapter } from './adapters/ConnectionResolverAdapter.js';

/**
 * Factory to create ConnectionResolver client
 *
 * @param config - Configuration with connection providers
 */
export const createConnectionResolver = (config: ConnectionResolverConfig): ConnectionResolverPort => {
  return new ConnectionResolverAdapter(config);
};
