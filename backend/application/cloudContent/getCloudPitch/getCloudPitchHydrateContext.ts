// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import type { GetCloudPitchInput } from './getCloudPitchValidateInput.js';

export interface GetCloudPitchContext {
  contentRef: ContentRef;
  isOwner: boolean;
  isEnrolled: boolean;
}

/**
 * HydrateContext step: load contentRef and determine access relationship for pitch.
 *
 * See getCloudContentHydrateContext for i18n fallback notes.
 */
export async function getCloudPitchHydrateContext(
  input: GetCloudPitchInput,
  ctx: HandlerContext
): Promise<Result<'NOT_FOUND', GetCloudPitchContext>> {
  const refId = ContentRefId.reconstitute(input.ref_id);

  // TODO: i18n fallback - same strategy as getCloudContent
  const contentRef = await ctx.contentRefsRepository.findById(refId);

  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const isOwner = contentRef.ownerEmail.value === ctx.userEmail;

  let isEnrolled = false;
  if (!isOwner) {
    const shares = await ctx.sharesRepository.findActiveByContentRef(contentRef.id);
    isEnrolled = shares.some(
      (s) => s.sharedWithEmail.value === ctx.userEmail
    );
  }

  return succeed({ contentRef, isOwner, isEnrolled });
}
