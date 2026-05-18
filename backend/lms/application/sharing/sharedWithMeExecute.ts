// entropy-single-export-ok: DDD pipeline step — function + entry type co-located by convention
import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { Email } from '../../domain/value-objects/index.js';
import type { SharedWithMeValidatedInput } from './sharedWithMeValidateInput.js';

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
 * Execute step: fetch all content shared with the current user.
 */
export const sharedWithMeExecute = async (input: SharedWithMeValidatedInput, ctx: HandlerContext): Promise<Result<string, SharedWithMeEntry[]>> => {
  const emailResult = Email.create(input.userEmail);
  if (!emailResult.ok) return fail(emailResult.error);

  const shares = await ctx.sharesRepository.findBySharedWith(emailResult.value);

  const entries: SharedWithMeEntry[] = [];
  for (const s of shares) {
    const contentRef = await ctx.contentRefsRepository.findById(s.contentRefId);
    entries.push({
      id: s.id.value,
      content_ref_id: s.contentRefId.value,
      shared_by: s.sharedByEmail.value,
      role: s.role === 'editor' ? 'WRITE' : 'READ',
      name: contentRef?.name ?? '',
      content_type: contentRef?.contentType ?? '',
      created_at: s.createdAt.toISOString(),
    });
  }

  return succeed(entries);
};
