// entropy-positional-args-excess-ok: DDD pipeline step — (request, ctx, param) is the architectural convention
import { filterFields } from '../../filters/FieldSecurityFilter.js';
import type { ShareContentOutput } from './shareContentExecute.js';

/**
 * Filter step: apply FLS to share response.
 * Strip internal IDs from non-owner viewers.
 */
export const shareContentFilter = (output: ShareContentOutput, viewerEmail: string, ownerEmail: string): Partial<ShareContentOutput> => {
  return filterFields(
    output as unknown as Record<string, unknown>,
    viewerEmail,
    ownerEmail,
    ['connectionId', 'fileId']
  ) as Partial<ShareContentOutput>;
};
