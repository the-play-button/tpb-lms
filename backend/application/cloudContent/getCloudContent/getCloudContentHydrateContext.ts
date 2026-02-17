import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import type { GetCloudContentInput } from './getCloudContentValidateInput.js';

export interface GetCloudContentContext {
  contentRef: ContentRef;
  isOwner: boolean;
  isEnrolled: boolean;
}

/**
 * HydrateContext step: load contentRef and determine access relationship.
 */
export async function getCloudContentHydrateContext(
  input: GetCloudContentInput,
  ctx: HandlerContext
): Promise<Result<'NOT_FOUND', GetCloudContentContext>> {
  const refId = ContentRefId.reconstitute(input.ref_id);

  const contentRef = input.lang
    ? await ctx.contentRefsRepository.findByIdWithFallback(refId, input.lang)
    : await ctx.contentRefsRepository.findById(refId);

  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const isOwner = contentRef.ownerEmail.value === ctx.userEmail;

  // Check enrollment: if not owner, look for an active share
  let isEnrolled = false;
  if (!isOwner) {
    const shares = await ctx.sharesRepository.findByContentRefId(contentRef.id);
    isEnrolled = shares.some(
      (s: ActiveShare) => s.sharedWithEmail.value === ctx.userEmail
    );
  }

  return succeed({ contentRef, isOwner, isEnrolled });
}
