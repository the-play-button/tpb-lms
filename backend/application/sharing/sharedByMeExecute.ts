// entropy-single-export-ok: DDD pipeline step — function + entry type co-located by convention
import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { Email } from '../../domain/value-objects/index.js';
import type { SharedByMeValidatedInput } from './sharedByMeValidateInput.js';

export interface SharedByMeEntry {
  id: string;
  content_ref_id: string;
  shared_with: string;
  role: string;
  created_at: string;
}

/**
 * Execute step: fetch all content shared by the current user.
 */
export const sharedByMeExecute = async (input: SharedByMeValidatedInput, ctx: HandlerContext): Promise<Result<string, SharedByMeEntry[]>> => {
  const emailResult = Email.create(input.userEmail);
  if (!emailResult.ok) return fail(emailResult.error);

  const shares = await ctx.sharesRepository.findBySharedBy(emailResult.value);

  const entries: SharedByMeEntry[] = shares.map((s) => ({
    id: s.id.value,
    content_ref_id: s.contentRefId.value,
    shared_with: s.sharedWithEmail.value,
    role: s.role === 'editor' ? 'WRITE' : 'READ',
    created_at: s.createdAt.toISOString(),
  }));

  return succeed(entries);
};
