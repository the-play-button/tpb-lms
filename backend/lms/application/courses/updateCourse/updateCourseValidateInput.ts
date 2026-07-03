import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';

const MediaSchema = z.object({ url: z.string(), type: z.string(), name: z.string().optional() });
const Schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoriesJson: z.array(z.string()).optional(),
  mediaJson: z.array(MediaSchema).optional(),
  isActive: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  languagesJson: z.array(z.string()).optional(),
});
export type UpdateCourseInput = z.infer<typeof Schema> & { courseId: string };

export const updateCourseValidateInput = async (request: Request, param?: string): Promise<Result<string, UpdateCourseInput>> => {
  if (!param) return fail('courseId path param is required');
  let body: unknown;
  try { body = await request.json(); } catch { return fail('invalid JSON body'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join('; '));
  return succeed({ ...parsed.data, courseId: param });
};
