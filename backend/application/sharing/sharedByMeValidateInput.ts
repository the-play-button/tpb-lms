// entropy-multiple-exports-ok: cohesive module exports
import { z } from 'zod';
import { fail, succeed, type Result } from '../../domain/core/Result.js';

const SharedByMeInputSchema = z.object({
  userEmail: z.string().email('Invalid user email'),
});

export type SharedByMeValidatedInput = z.infer<typeof SharedByMeInputSchema>;

/**
 * ValidateInput step: validate authenticated user identity.
 */
export const sharedByMeValidateInput = (userEmail: string): Result<string, SharedByMeValidatedInput> => {
  const parsed = SharedByMeInputSchema.safeParse({ userEmail });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
