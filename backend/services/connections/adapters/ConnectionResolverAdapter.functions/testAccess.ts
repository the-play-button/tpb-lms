import type { ConnectionResolverConfig } from '../../ConnectionResolverPort.js';

/**
 * Test folder access for a given connection and folder.
 * Delegates to the config's testAccess function.
 */
export const testAccess = async (config: ConnectionResolverConfig, connectionId: string, folderId: string): Promise<void> => {
  await config.testAccess(connectionId, folderId);
};
