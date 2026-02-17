// entropy-multiple-exports-ok: cohesive module exports
// entropy-audit-trail-ok: audit at higher level
import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { Email } from '../../domain/value-objects/index.js';
import { filterFields } from '../filters/FieldSecurityFilter.js';

export interface SharedByMeEntry {
  id: string;
  content_ref_id: string;
  shared_with: string;
  role: string;
  created_at: string;
}

/**
 * Handle: fetch all content shared by the current user.
 *
 * Uses sharesRepository.findBySharedBy(userEmail) and applies FLS.
 */
export async function sharedByMeHandle(
  ctx: HandlerContext
): Promise<Result<string, SharedByMeEntry[]>> {
  try {
    const emailResult = Email.create(ctx.userEmail);
    if (!emailResult.ok) return fail(emailResult.error);

    const shares = await ctx.sharesRepository.findBySharedBy(emailResult.value);

    const entries = shares.map((s) => {
      const raw: SharedByMeEntry = {
        id: s.id.value,
        content_ref_id: s.contentRefId.value,
        shared_with: s.sharedWithEmail.value,
        role: s.role === 'editor' ? 'WRITE' : 'READ',
        created_at: s.createdAt.toISOString(),
      };
      // FLS: viewer is the owner (current user), so no fields are stripped
      return filterFields(
        raw as unknown as Record<string, unknown>,
        ctx.userEmail,
        ctx.userEmail
      ) as unknown as SharedByMeEntry;
    });

    return succeed(entries);
  } catch (error) {
    return fail((error as Error).message);
  }
}
