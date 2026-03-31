// entropy-multiple-exports-ok: cohesive module exports
import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const ShareContentInputSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['READ', 'WRITE'], { errorMap: () => ({ message: 'role must be READ or WRITE' }) }),
});

export type ShareContentInput = z.infer<typeof ShareContentInputSchema>;

/**
 * ValidateInput step: parse and validate share request body.
 */
export const shareContentValidateInput = async (request: Request): Promise<Result<string, ShareContentInput>> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }

  const parsed = ShareContentInputSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return fail(msg);
  }

  return succeed(parsed.data);
};
