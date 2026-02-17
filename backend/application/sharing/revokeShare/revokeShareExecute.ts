// entropy-multiple-exports-ok: cohesive module exports
// entropy-audit-trail-ok: audit at higher level
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email } from '../../../domain/value-objects/index.js';
import { shareRevoked } from '../../../domain/events/events/ShareRevoked.js';
import type { RevokeShareContext } from './revokeShareHydrateContext.js';

export interface RevokeShareOutput {
  shareId: string;
  contentRefId: string;
  revokedAt: string;
}

/**
 * Execute step: revoke the share in domain, persist, emit event.
 */
export async function revokeShareExecute(
  context: RevokeShareContext,
  ctx: HandlerContext
): Promise<Result<string, RevokeShareOutput>> {
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
    shareId: context.share.id.value,
    contentRefId: context.contentRef.id.value,
    revokedAt: revokedShare.revokedAt.toISOString(),
  });
}
