import { fail, succeed, type Result } from '../../domain/core/Result.js';
import type { HandlerContext } from '../../types/HandlerContext.js';
import { Email } from '../../domain/value-objects/index.js';
import { filterFields } from '../filters/FieldSecurityFilter.js';
import type { SharedByMeAssertedInput } from './sharedByMeAssert.js';

export interface SharedByMeEntry {
  id: string;
  content_ref_id: string;
  shared_with: string;
  role: string;
  created_at: string;
}

/**
 * Execute step: fetch all content shared by the current user and apply FLS.
 */
export const sharedByMeExecute = async (input: SharedByMeAssertedInput, ctx: HandlerContext): Promise<Result<string, SharedByMeEntry[]>> => {
  try {
    const emailResult = Email.create(input.userEmail);
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
};
