// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ShareId } from '../../../domain/value-objects/index.js';

export interface RevokeShareContext {
  share: ActiveShare;
  contentRef: ContentRef;
  isOwner: boolean;
}

/**
 * HydrateContext step: load the share and its parent contentRef.
 */
export const revokeShareHydrateContext = async (rawShareId: string, ctx: HandlerContext): Promise<Result<'NOT_FOUND', RevokeShareContext>> => {
  const shareId = ShareId.reconstitute(rawShareId);

  const share = await ctx.sharesRepository.findById(shareId);
  if (!share) {
    return fail('NOT_FOUND' as const);
  }

  // Only active shares can be revoked
  if (share.kind !== 'active') {
    return fail('NOT_FOUND' as const);
  }

  const contentRef = await ctx.contentRefsRepository.findById(share.contentRefId);
  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const isOwner = contentRef.ownerEmail.value === ctx.userEmail;

  return succeed({ share, contentRef, isOwner });
};
