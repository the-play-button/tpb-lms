import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * HydrateContext step: no domain entities to load for listing connections.
 * The connection resolver fetches directly in Execute.
 */
export const listConnectionsHydrateContext = (): Result<string, void> => {
  return succeed(undefined);
};
