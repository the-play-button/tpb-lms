import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import type { ShareContentInput } from './createShareValidateInput.js';

export interface ShareContentContext {
  contentRef: ContentRef;
  existingShares: ActiveShare[];
}

/**
 * HydrateContext step: load contentRef and existing shares.
 */
export const createShareHydrateContext = async (input: ShareContentInput, ctx: HandlerContext): Promise<Result<'NOT_FOUND', ShareContentContext>> => {
  const refId = ContentRefId.reconstitute(input.ref_id);

  const contentRef = await ctx.contentRefsRepository.findById(refId);
  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const existingShares = await ctx.sharesRepository.findActiveByContentRef(contentRef.id);

  return succeed({ contentRef, existingShares });
};
