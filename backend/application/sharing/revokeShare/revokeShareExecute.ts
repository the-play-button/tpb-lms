// entropy-multiple-exports-ok: revokeShareExecute module has 2 tightly-coupled exports sharing internal state
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
  const { share, contentRef } = context;
  const revokerEmailResult = Email.create(ctx.userEmail);
  if (!revokerEmailResult.ok) return fail(revokerEmailResult.error);

  const revokeResult = share.revoke(revokerEmailResult.value);
  if (!revokeResult.ok) return fail(revokeResult.error);

  const revokedShare = revokeResult.value;

  await ctx.sharesRepository.save(revokedShare);

  await ctx.domainEvents.publish(
    shareRevoked(
      share.id.value,
      contentRef.id.value,
      ctx.userEmail
    )
  );

  return succeed({
    share_id: share.id.value,
    content_ref_id: contentRef.id.value,
    revoked_at: revokedShare.revokedAt.toISOString(),
  });
};
