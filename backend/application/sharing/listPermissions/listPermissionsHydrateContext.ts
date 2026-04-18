// entropy-multiple-exports-ok: listPermissionsHydrateContext module has 2 tightly-coupled exports sharing internal state
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import type { ListPermissionsValidatedInput } from './listPermissionsValidateInput.js';

export interface ListPermissionsContext {
  contentRef: ContentRef;
  shares: ActiveShare[];
  isOwner: boolean;
}

/**
 * HydrateContext step: load contentRef and active shares.
 */
export const listPermissionsHydrateContext = async (input: ListPermissionsValidatedInput, ctx: HandlerContext): Promise<Result<'NOT_FOUND', ListPermissionsContext>> => {
  const refId = ContentRefId.reconstitute(input.ref_id);
  const contentRef = await ctx.contentRefsRepository.findById(refId);
  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const isOwner = contentRef.ownerEmail.value === ctx.userEmail;
  const shares = await ctx.sharesRepository.findActiveByContentRef(contentRef.id);

  return succeed({ contentRef, shares, isOwner });
};
