// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
import type { ConnectionResolverConfig } from '../../ConnectionResolverPort.js';
import { ValidationError } from '../../../../types/errors.js';

/**
 * Test folder access for a given connection and folder.
 * Delegates to the config's testAccess function.
 */
export const testAccess = async (config: ConnectionResolverConfig, connectionId: string, folderId: string): Promise<void> => {
  if (config.testAccess) {
    await config.testAccess(connectionId, folderId);
  } else {
    throw new ValidationError('No folder access tester configured');
  }
};
