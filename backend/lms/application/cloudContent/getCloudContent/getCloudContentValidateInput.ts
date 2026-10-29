import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const GetCloudContentInputSchema = z.object({
  refId: z.string().min(1, 'refId is required'),
  lang: z.string().optional(),
});

export type GetCloudContentInput = z.infer<typeof GetCloudContentInputSchema>;

/**
 * ValidateInput step: parse and validate query parameters.
 */
export const getCloudContentValidateInput = (request: Request): Result<string, GetCloudContentInput> => {
  const url = new URL(request.url);
  const raw = {
    refId: url.searchParams.get('refId') ?? undefined,
    lang: url.searchParams.get('lang') ?? undefined,
  };

  const parsed = GetCloudContentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
