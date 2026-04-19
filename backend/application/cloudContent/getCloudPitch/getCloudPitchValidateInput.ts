import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const GetCloudPitchInputSchema = z.object({
  ref_id: z.string().min(1, 'ref_id is required'),
  lang: z.string().optional(),
});

export type GetCloudPitchInput = z.infer<typeof GetCloudPitchInputSchema>;

/**
 * ValidateInput step: parse and validate query parameters for pitch download.
 */
export const getCloudPitchValidateInput = (request: Request): Result<string, GetCloudPitchInput> => {
  const url = new URL(request.url);
  const raw = {
    ref_id: url.searchParams.get('ref_id') ?? undefined,
    lang: url.searchParams.get('lang') ?? undefined,
  };

  const parsed = GetCloudPitchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
