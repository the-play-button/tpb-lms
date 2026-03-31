// entropy-multiple-exports-ok: cohesive module exports
// entropy-audit-trail-ok: audit at higher level
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email } from '../../../domain/value-objects/index.js';
import { shareRevoked } from '../../../domain/events/events/ShareRevoked.js';
import type { RevokeShareContext } from './revokeShareHydrateContext.js';

export interface RevokeShareOutput {
  share_id: string;
  content_ref_id: string;
  revoked_at: string;
}

/**
 * Execute step: revoke the share in domain, persist, emit event.
 */
export const revokeShareExecute = async (context: RevokeShareContext, ctx: HandlerContext): Promise<Result<string, RevokeShareOutput>> => {
  const revokerEmailResult = Email.create(ctx.userEmail);
  if (!revokerEmailResult.ok) return fail(revokerEmailResult.error);

  const revokeResult = context.share.revoke(revokerEmailResult.value);
  if (!revokeResult.ok) return fail(revokeResult.error);

  const revokedShare = revokeResult.value;

  // Persist the revoked share (overwrites the active share)
  await ctx.sharesRepository.save(revokedShare);

  // Emit domain event
  await ctx.domainEvents.publish(
    shareRevoked(
      context.share.id.value,
      context.contentRef.id.value,
      ctx.userEmail
    )
  );

  return succeed({
    share_id: context.share.id.value,
    content_ref_id: context.contentRef.id.value,
    revoked_at: revokedShare.revokedAt.toISOString(),
  });
};
