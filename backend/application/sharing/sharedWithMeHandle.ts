// entropy-multiple-exports-ok: cohesive module exports
// entropy-audit-trail-ok: audit at higher level
import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { Email } from '../../domain/value-objects/index.js';
import { filterFields } from '../filters/FieldSecurityFilter.js';

export interface SharedWithMeEntry {
  id: string;
  content_ref_id: string;
  shared_by: string;
  role: string;
  name: string;
  content_type: string;
  created_at: string;
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

    const entries: SharedWithMeEntry[] = [];
    for (const s of shares) {
      const contentRef = await ctx.contentRefsRepository.findById(s.contentRefId);
      const raw: SharedWithMeEntry = {
        id: s.id.value,
        content_ref_id: s.contentRefId.value,
        shared_by: s.sharedByEmail.value,
        role: s.role === 'editor' ? 'WRITE' : 'READ',
        name: contentRef?.name ?? '',
        content_type: contentRef?.contentType ?? '',
        created_at: s.createdAt.toISOString(),
      };
      // FLS: viewer is the current user, owner is whoever shared it
      const filtered = filterFields(
        raw as unknown as Record<string, unknown>,
        ctx.userEmail,
        s.sharedByEmail.value
      ) as unknown as SharedWithMeEntry;
      entries.push(filtered);
    }

    return succeed(entries);
  } catch (error) {
    return fail((error as Error).message);
  }
}
