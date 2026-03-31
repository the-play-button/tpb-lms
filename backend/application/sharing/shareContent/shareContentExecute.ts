// entropy-multiple-exports-ok: cohesive module exports
// entropy-audit-trail-ok: audit at higher level
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email, ShareId } from '../../../domain/value-objects/index.js';
import { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { ShareRole } from '../../../domain/entities/ContentRef/SharedContentRef.js';
import { contentShared } from '../../../domain/events/events/ContentShared.js';
import type { ShareContentContext } from './shareContentHydrateContext.js';
import type { ShareContentInput } from './shareContentValidateInput.js';

export interface ShareContentOutput {
  share_id: string;
  content_ref_id: string;
  shared_with: string;
  role: string;
}

/**
 * Execute step: create the share in domain, persist, emit event.
 */
export const shareContentExecute = async (
  input: ShareContentInput,
  context: ShareContentContext,
  ctx: HandlerContext
): Promise<Result<string, ShareContentOutput>> => {
  const targetEmailResult = Email.create(input.email);
  if (!targetEmailResult.ok) return fail(targetEmailResult.error);

  const shareIdResult = ShareId.create(crypto.randomUUID());
  if (!shareIdResult.ok) return fail(shareIdResult.error);

  // Map input role to domain role
  const domainRole: ShareRole = input.role === 'WRITE' ? 'editor' : 'viewer';

  const shareResult = ActiveShare.create({
    id: shareIdResult.value,
    contentRefId: context.contentRef.id,
    sharedByEmail: context.contentRef.ownerEmail,
    sharedWithEmail: targetEmailResult.value,
    role: domainRole,
  });
  if (!shareResult.ok) return fail(shareResult.error);

  // Persist
  await ctx.sharesRepository.save(shareResult.value);

  // Emit domain event
  await ctx.domainEvents.publish(
    contentShared(
      context.contentRef.id.value,
      shareIdResult.value.value,
      ctx.userEmail,
      input.email,
      input.role
    )
  );

  return succeed({
    share_id: shareIdResult.value.value,
    content_ref_id: context.contentRef.id.value,
    shared_with: input.email,
    role: input.role,
  });
};
