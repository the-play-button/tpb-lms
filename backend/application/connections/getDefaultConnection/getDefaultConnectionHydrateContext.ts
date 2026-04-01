import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * HydrateContext step: no domain entities to load for getting default connection.
 * The connection resolver fetches directly in Execute.
 */
export const getDefaultConnectionHydrateContext = (): Result<string, void> => {
  return succeed(undefined);
};
