import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const ListPermissionsInputSchema = z.object({
  refId: z.string().min(1, 'refId is required'),
});

export type ListPermissionsValidatedInput = z.infer<typeof ListPermissionsInputSchema>;

/**
 * ValidateInput step: validate refId path parameter.
 */
export const listPermissionsValidateInput = (rawRefId: string): Result<string, ListPermissionsValidatedInput> => {
  const parsed = ListPermissionsInputSchema.safeParse({ refId: rawRefId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
