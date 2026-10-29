import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const GetCloudPitchInputSchema = z.object({
  refId: z.string().min(1, 'refId is required'),
  lang: z.string().optional(),
});

export type GetCloudPitchInput = z.infer<typeof GetCloudPitchInputSchema>;

/**
 * ValidateInput step: parse and validate query parameters for pitch download.
 */
export const getCloudPitchValidateInput = (request: Request): Result<string, GetCloudPitchInput> => {
  const url = new URL(request.url);
  const raw = {
    refId: url.searchParams.get('refId') ?? undefined,
    lang: url.searchParams.get('lang') ?? undefined,
  };

  const parsed = GetCloudPitchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
