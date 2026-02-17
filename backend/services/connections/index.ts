/**
 * ConnectionResolver Service - Multi-tenant connection routing
 *
 * USAGE:
 * const resolver = createConnectionResolver({ ... });
 * const conn = await resolver.resolveConnection({ provider: 'onedrive', folderId });
 */

// Port types
export type {
  ConnectionResolverPort,
  ConnectionResolverConfig,
  ResolveConnectionOptions,
} from './ConnectionResolverPort.js';

// Adapters
export { ConnectionResolverAdapter } from './adapters/ConnectionResolverAdapter.js';

import type { ConnectionResolverPort, ConnectionResolverConfig } from './ConnectionResolverPort.js';
import { ConnectionResolverAdapter } from './adapters/ConnectionResolverAdapter.js';

/**
 * Factory to create ConnectionResolver client
 *
 * @param config - Configuration with connection providers
 */
export function createConnectionResolver(config: ConnectionResolverConfig): ConnectionResolverPort {
  return new ConnectionResolverAdapter(config);
}
