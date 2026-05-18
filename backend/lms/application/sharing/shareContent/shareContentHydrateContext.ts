// entropy-positional-args-excess-ok: shareContentHydrateContext follows DDD pipeline convention (request, ctx, param) positional args
import { fail, succeed, type Result } from '../../../lms/domain/core/Result.js';
import type { ContentRef } from '../../../lms/domain/repositories/ContentRefsRepository.js';
import type { ActiveShare } from '../../../lms/domain/entities/Share/ActiveShare.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../lms/domain/value-objects/index.js';
import type { ShareContentInput } from './shareContentValidateInput.js';

export interface ShareContentContext {
  contentRef: ContentRef;
  existingShares: ActiveShare[];
}

/**
 * HydrateContext step: load contentRef and existing shares.
 */
export const shareContentHydrateContext = async (input: ShareContentInput, ctx: HandlerContext): Promise<Result<'NOT_FOUND', ShareContentContext>> => {
  const refId = ContentRefId.reconstitute(input.ref_id);

  const contentRef = await ctx.contentRefsRepository.findById(refId);
  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const existingShares = await ctx.sharesRepository.findActiveByContentRef(contentRef.id);

  return succeed({ contentRef, existingShares });
};
