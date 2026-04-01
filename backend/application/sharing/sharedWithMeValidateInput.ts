// entropy-multiple-exports-ok: cohesive module exports
import { z } from 'zod';
import { fail, succeed, type Result } from '../../domain/core/Result.js';

const SharedWithMeInputSchema = z.object({
  userEmail: z.string().email('Invalid user email'),
});

export type SharedWithMeValidatedInput = z.infer<typeof SharedWithMeInputSchema>;

/**
 * ValidateInput step: validate authenticated user identity.
 */
export const sharedWithMeValidateInput = (userEmail: string): Result<string, SharedWithMeValidatedInput> => {
  const parsed = SharedWithMeInputSchema.safeParse({ userEmail });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
