// entropy-single-export-ok: DDD pipeline step — function + AssertedInput type co-located by convention
import { z } from 'zod';
import { fail, succeed, type Result } from '../../domain/core/Result.js';

const SharedByMeAssertSchema = z.object({
  userEmail: z.string().email('Invalid user email'),
});

export type SharedByMeAssertedInput = z.infer<typeof SharedByMeAssertSchema>;

/**
 * Assert step: validate authenticated user identity.
 */
export const sharedByMeAssert = (userEmail: string): Result<string, SharedByMeAssertedInput> => {
  const parsed = SharedByMeAssertSchema.safeParse({ userEmail });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
