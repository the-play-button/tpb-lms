import { z } from 'zod';
import { fail, succeed, type Result } from '../../domain/core/Result.js';

const SharedWithMeAssertSchema = z.object({
  userEmail: z.string().email('Invalid user email'),
});

export type SharedWithMeAssertedInput = z.infer<typeof SharedWithMeAssertSchema>;

/**
 * Assert step: validate authenticated user identity.
 */
export function sharedWithMeAssert(
  userEmail: string
): Result<string, SharedWithMeAssertedInput> {
  const parsed = SharedWithMeAssertSchema.safeParse({ userEmail });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
}
