import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * ValidateContext step: no domain invariants to enforce for listing connections.
 */
export const listConnectionsValidateContext = (): Result<string, void> => {
  return succeed(undefined);
};
