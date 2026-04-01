// entropy-multiple-exports-ok: cohesive module exports
import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const ListPermissionsInputSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
});

export type ListPermissionsValidatedInput = z.infer<typeof ListPermissionsInputSchema>;

/**
 * ValidateInput step: validate ref_id path parameter.
 */
export const listPermissionsValidateInput = (rawRefId: string): Result<string, ListPermissionsValidatedInput> => {
  const parsed = ListPermissionsInputSchema.safeParse({ ref_id: rawRefId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
