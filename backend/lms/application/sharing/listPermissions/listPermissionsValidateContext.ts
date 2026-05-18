import { succeed, type Result } from '../../../domain/core/Result.js';
import type { ListPermissionsContext } from './listPermissionsHydrateContext.js';

/**
 * ValidateContext step: domain invariants (actor-independent).
 *
 * No domain invariants beyond contentRef existence (guaranteed by HydrateContext).
 */
export const listPermissionsValidateContext = (_context: ListPermissionsContext): Result<string, void> => {
  return succeed(undefined);
};
