import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const RevokeShareInputSchema = z.object({
  share_id: z.string().min(1, 'share_id is required'),
});

export type RevokeShareValidatedInput = z.infer<typeof RevokeShareInputSchema>;

/**
 * ValidateInput step: validate share_id path parameter.
 */
export const revokeShareValidateInput = (shareId: string): Result<string, RevokeShareValidatedInput> => {
  const parsed = RevokeShareInputSchema.safeParse({ share_id: shareId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
