import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const MediaSchema = z.object({ url: z.string(), type: z.string(), name: z.string().optional() });
const Schema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  categoriesJson: z.array(z.string()).optional(),
  mediaJson: z.array(MediaSchema).optional(),
  isPrivate: z.boolean().optional(),
  languagesJson: z.array(z.string()).optional(),
});
export type CreateCourseInput = z.infer<typeof Schema>;

export const createCourseValidateInput = async (request: Request): Promise<Result<string, CreateCourseInput>> => {
  let body: unknown;
  try { body = await request.json(); } catch { return fail('invalid JSON body'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join('; '));
  return succeed(parsed.data);
};
