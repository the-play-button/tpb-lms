import type { ConnectionResolverConfig } from '../../ConnectionResolverPort.js';
import type { ConnectionInfo } from '../../../types/ConnectionInfo.js';
import { NotFoundError } from '../../../../types/errors.js';
import { testAccess } from './testAccess.js';

/**
 * Find a working connection for the given provider and folder.
 * Tries each connection until one has folder access (multi-tenant support).
 */
export const findWorkingConnection = async (config: ConnectionResolverConfig, provider: string, folderId: string): Promise<ConnectionInfo> => {
  const connections = await config.getConnectionsByProvider(provider);

  if (connections.length === 0) {
    throw new NotFoundError(
      `${provider} connection`,
      `Please connect your ${provider} account.`,
    );
  }

  const errors: string[] = [];
  for (const conn of connections) {
    try {
      await testAccess(config, conn.id, folderId);
      return conn;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      errors.push(`${conn.id}: ${msg}`);
    }
  }

  throw new NotFoundError(
    `${provider} connection with folder access`,
    `Tried ${connections.length} connection(s)`,
  );
};
