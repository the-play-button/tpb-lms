import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const MediaSchema = z.object({ url: z.string(), type: z.string(), name: z.string().optional() });
const Schema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  mediaJson: z.array(MediaSchema).optional(),
  rawJson: z.record(z.string(), z.unknown()).optional(),
});
export type CreateProgramInput = z.infer<typeof Schema>;

export const createProgramValidateInput = async (request: Request): Promise<Result<string, CreateProgramInput>> => {
  let body: unknown;
  try { body = await request.json(); } catch { return fail('invalid JSON body'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join('; '));
  return succeed(parsed.data);
};
