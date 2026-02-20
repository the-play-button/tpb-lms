import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const ListPermissionsAssertSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
});

export type ListPermissionsAssertedInput = z.infer<typeof ListPermissionsAssertSchema>;

/**
 * Assert step: validate presence of required path parameters.
 */
export function listPermissionsAssert(
  rawRefId: string
): Result<string, ListPermissionsAssertedInput> {
  const parsed = ListPermissionsAssertSchema.safeParse({ ref_id: rawRefId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
}
