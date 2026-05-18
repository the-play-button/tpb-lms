import { succeed, type Result } from '../../domain/core/Result.js';

/**
 * HydrateContext step: no domain entities to pre-load for sharedByMe listing.
 * The shares repository query happens in Execute.
 */
export const sharedByMeHydrateContext = (): Result<string, void> => {
  return succeed(undefined);
};
