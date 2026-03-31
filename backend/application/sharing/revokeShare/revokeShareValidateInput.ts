// entropy-multiple-exports-ok: cohesive module exports
import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const RevokeShareInputSchema = z.object({
  share_id: z.string().min(1, 'share_id is required'),
});

export type RevokeShareInput = z.infer<typeof RevokeShareInputSchema>;

/**
 * ValidateInput step: parse and validate revoke request.
 */
export const revokeShareValidateInput = async (request: Request): Promise<Result<string, RevokeShareInput>> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }

  const parsed = RevokeShareInputSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return fail(msg);
  }

  return succeed(parsed.data);
};
