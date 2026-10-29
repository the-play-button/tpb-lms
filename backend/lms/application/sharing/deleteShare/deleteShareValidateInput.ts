import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const RevokeShareInputSchema = z.object({
  shareId: z.string().min(1, 'shareId is required'),
});

export type RevokeShareValidatedInput = z.infer<typeof RevokeShareInputSchema>;

/**
 * ValidateInput step: validate shareId path parameter.
 */
export const deleteShareValidateInput = (shareId: string): Result<string, RevokeShareValidatedInput> => {
  const parsed = RevokeShareInputSchema.safeParse({ shareId: shareId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
