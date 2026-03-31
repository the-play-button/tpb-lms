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
export const resolveConnection = async (config: ConnectionResolverConfig, params: ResolveConnectionOptions): Promise<ConnectionInfo> => {
  if (params.connectionId) {
    return { id: params.connectionId, integrationType: '', category: 'storage' };
  }

  if (params.provider && params.folderId) {
    return findWorkingConnection(config, params.provider, params.folderId);
  }

  return config.getDefaultConnection();
};
