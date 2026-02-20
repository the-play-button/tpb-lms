import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const ShareContentAssertSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
});

export type ShareContentAssertedInput = z.infer<typeof ShareContentAssertSchema>;

/**
 * Assert step: validate presence of required path parameters.
 */
export function shareContentAssert(
  refId: string
): Result<string, ShareContentAssertedInput> {
  const parsed = ShareContentAssertSchema.safeParse({ ref_id: refId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
}
