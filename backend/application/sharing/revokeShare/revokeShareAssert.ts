import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const RevokeShareAssertSchema = z.object({
  share_id: z.string().min(1, 'share_id is required'),
});

export type RevokeShareAssertedInput = z.infer<typeof RevokeShareAssertSchema>;

/**
 * Assert step: validate presence of required path parameters.
 */
export function revokeShareAssert(
  shareId: string
): Result<string, RevokeShareAssertedInput> {
  const parsed = RevokeShareAssertSchema.safeParse({ share_id: shareId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
}
