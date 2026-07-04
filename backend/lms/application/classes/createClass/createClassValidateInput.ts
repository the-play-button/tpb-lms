import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import { NODE_KINDS } from '../../../domain/NodeKind.js';

const MediaSchema = z.object({ url: z.string(), type: z.string(), name: z.string().optional() });
const Schema = z.object({
  id: z.string().min(1).optional(),
  courseId: z.string().min(1, 'courseId is required'),
  parentClassId: z.string().min(1).nullable().optional(),
  nodeKind: z.enum(NODE_KINDS).default('LESSON'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  mediaJson: z.array(MediaSchema).optional(),
  sysOrderIndex: z.number().int().optional(),
  contentMd: z.string().optional(),
  stepType: z.string().optional(),
  rawJson: z.record(z.string(), z.unknown()).optional(),
});
export type CreateClassInput = z.infer<typeof Schema>;

export const createClassValidateInput = async (request: Request): Promise<Result<string, CreateClassInput>> => {
  let body: unknown;
  try { body = await request.json(); } catch { return fail('invalid JSON body'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join('; '));
  return succeed(parsed.data);
};
