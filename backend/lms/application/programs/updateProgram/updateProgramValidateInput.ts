import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const MediaSchema = z.object({ url: z.string(), type: z.string(), name: z.string().optional() });
const Schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  mediaJson: z.array(MediaSchema).optional(),
  isActive: z.boolean().optional(),
  rawJson: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateProgramInput = z.infer<typeof Schema> & { programId: string };

export const updateProgramValidateInput = async (request: Request, param?: string): Promise<Result<string, UpdateProgramInput>> => {
  if (!param) return fail('programId path param is required');
  let body: unknown;
  try { body = await request.json(); } catch { return fail('invalid JSON body'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join('; '));
  return succeed({ ...parsed.data, programId: param });
};
