import type { ConnectionResolverConfig, ResolveConnectionOptions } from '../../ConnectionResolverPort.js';
import type { ConnectionInfo } from '../../../types/ConnectionInfo.js';
import { findWorkingConnection } from './findWorkingConnection.js';

/**
 * Resolve a connection based on request parameters.
 *
 * Priority:
 * 1. Explicit connectionId -> return directly
 * 2. Provider + folderId  -> findWorkingConnection (multi-tenant routing)
 * 3. Fallback             -> getDefaultConnection (admin TPB)
 */
export async function resolveConnection(
  config: ConnectionResolverConfig,
  params: ResolveConnectionOptions,
): Promise<ConnectionInfo> {
  // If explicit connectionId provided, use it
  if (params.connectionId) {
    return { id: params.connectionId, integrationType: '', category: 'storage' };
  }

  // If provider specified, use intelligent routing
  if (params.provider && params.folderId) {
    return findWorkingConnection(config, params.provider, params.folderId);
  }

  // Fallback to default connection (admin TPB)
  return config.getDefaultConnection();
}
