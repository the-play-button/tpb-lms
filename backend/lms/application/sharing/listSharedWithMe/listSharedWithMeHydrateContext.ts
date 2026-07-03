import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * HydrateContext step: no domain entities to pre-load for listSharedWithMe listing.
 * The shares repository query happens in Execute.
 */
export const listSharedWithMeHydrateContext = (): Result<string, void> => {
  return succeed(undefined);
};
