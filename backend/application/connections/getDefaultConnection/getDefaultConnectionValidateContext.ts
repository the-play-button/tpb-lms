import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * ValidateContext step: no domain invariants to enforce for getting default connection.
 */
export const getDefaultConnectionValidateContext = (): Result<string, void> => {
  return succeed(undefined);
};
