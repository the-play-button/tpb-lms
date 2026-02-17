// entropy-multiple-exports-ok: cohesive module exports
// entropy-audit-trail-ok: audit at higher level
import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { Email } from '../../domain/value-objects/index.js';
import { filterFields } from '../filters/FieldSecurityFilter.js';

export interface SharedWithMeEntry {
  shareId: string;
  contentRefId: string;
  sharedByEmail: string;
  role: string;
  createdAt: string;
}

/**
 * Handle: fetch all content shared with the current user.
 *
 * Uses sharesRepository.findBySharedWith(userEmail) and applies FLS.
 */
export async function sharedWithMeHandle(
  ctx: HandlerContext
): Promise<Result<string, SharedWithMeEntry[]>> {
  try {
    const emailResult = Email.create(ctx.userEmail);
    if (!emailResult.ok) return fail(emailResult.error);

    const shares = await ctx.sharesRepository.findBySharedWith(emailResult.value);

    const entries = shares.map((s) => {
      const raw: SharedWithMeEntry = {
        shareId: s.id.value,
        contentRefId: s.contentRefId.value,
        sharedByEmail: s.sharedByEmail.value,
        role: s.role,
        createdAt: s.createdAt.toISOString(),
      };
      // FLS: viewer is the current user, owner is whoever shared it
      return filterFields(
        raw as unknown as Record<string, unknown>,
        ctx.userEmail,
        s.sharedByEmail.value
      ) as unknown as SharedWithMeEntry;
    });

    return succeed(entries);
  } catch (error) {
    return fail((error as Error).message);
  }
}
