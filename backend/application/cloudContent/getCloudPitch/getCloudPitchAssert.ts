// entropy-single-export-ok: DDD pipeline step — function + AssertedInput type co-located by convention
import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const GetCloudPitchAssertSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
});

export type GetCloudPitchAssertedInput = z.infer<typeof GetCloudPitchAssertSchema>;

/**
 * Assert step: validate presence of required request parameters.
 */
export const getCloudPitchAssert = (request: Request): Result<string, GetCloudPitchAssertedInput> => {
  const url = new URL(request.url);
  const raw = { ref_id: url.searchParams.get('ref_id') ?? undefined };

  const parsed = GetCloudPitchAssertSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
