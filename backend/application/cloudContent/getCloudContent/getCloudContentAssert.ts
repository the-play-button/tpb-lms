import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const GetCloudContentAssertSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
});

export type GetCloudContentAssertedInput = z.infer<typeof GetCloudContentAssertSchema>;

/**
 * Assert step: validate presence of required request parameters.
 */
export const getCloudContentAssert = (request: Request): Result<string, GetCloudContentAssertedInput> => {
  const url = new URL(request.url);
  const raw = { ref_id: url.searchParams.get('ref_id') ?? undefined };

  const parsed = GetCloudContentAssertSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
