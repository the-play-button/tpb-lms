import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const ShareContentInputSchema = z.object({
  refId: z.string().min(1, 'refId is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['READ', 'WRITE'], { errorMap: () => ({ message: 'role must be READ or WRITE' }) }),
});

export type ShareContentInput = z.infer<typeof ShareContentInputSchema>;

/**
 * ValidateInput step: validate path param (refId) and request body (email, role).
 */
export const createShareValidateInput = async (request: Request, refId: string): Promise<Result<string, ShareContentInput>> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }

  const parsed = ShareContentInputSchema.safeParse({ ...(body as object), refId: refId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join('; '));
  }

  return succeed(parsed.data);
};
