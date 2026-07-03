import { succeed, type Result } from '../../../domain/core/Result.js';

/**
 * HydrateContext step: no domain entities to pre-load for listSharedByMe listing.
 * The shares repository query happens in Execute.
 */
export const listSharedByMeHydrateContext = (): Result<string, void> => {
  return succeed(undefined);
};
