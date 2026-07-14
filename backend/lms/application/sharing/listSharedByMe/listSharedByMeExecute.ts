import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email } from '../../../domain/value-objects/index.js';
import type { SharedByMeValidatedInput } from './listSharedByMeValidateInput.js';

import type { SharedByMeEntry } from './listSharedByMeExecute.types';
export type { SharedByMeEntry };



/**
 * Execute step: fetch all content shared by the current user.
 */
export const listSharedByMeExecute = async (input: SharedByMeValidatedInput, ctx: HandlerContext): Promise<Result<string, SharedByMeEntry[]>> => {
  const emailResult = Email.create(input.userEmail);
  if (!emailResult.ok) return fail(emailResult.error);

  const shares = await ctx.sharesRepository.findBySharedBy(emailResult.value);

  const entries: SharedByMeEntry[] = shares.map<SharedByMeEntry>((s) => ({
    id: s.id.value,
    content_ref_id: s.contentRefId.value,
    shared_with: s.sharedWithEmail.value,
    role: s.role === 'editor' ? 'WRITE' : 'READ',
    created_at: s.createdAt.toISOString(),
  }));

  return succeed(entries);
};
