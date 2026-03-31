// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
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
 *
 * i18n fallback: if a lang is requested, we first look for a translated ref,
 * then fall back to the base ref via findById. The repository only has findById;
 * language routing is the caller's responsibility (planned for a future layer).
 */
export const getCloudContentHydrateContext = async (input: GetCloudContentInput, ctx: HandlerContext): Promise<Result<'NOT_FOUND', GetCloudContentContext>> => {
  const refId = ContentRefId.reconstitute(input.ref_id);

  // TODO: i18n fallback - for now, always use findById.
  // add lookup logic here: try translated ref first, fall back to source.
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
};
