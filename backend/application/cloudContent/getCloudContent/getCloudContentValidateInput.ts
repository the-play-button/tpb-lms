import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const GetCloudContentInputSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
  lang: z.string().optional(),
});

export type GetCloudContentInput = z.infer<typeof GetCloudContentInputSchema>;

/**
 * ValidateInput step: parse and validate query parameters.
 */
export function getCloudContentValidateInput(
  request: Request
): Result<string, GetCloudContentInput> {
  const url = new URL(request.url);
  const raw = {
    ref_id: url.searchParams.get('ref_id') ?? undefined,
    lang: url.searchParams.get('lang') ?? undefined,
  };

  const parsed = GetCloudContentInputSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return fail(msg);
  }

  return succeed(parsed.data);
}
