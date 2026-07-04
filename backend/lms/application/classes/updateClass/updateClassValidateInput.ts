import { z } from 'zod';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import { NODE_KINDS } from '../../../domain/NodeKind.js';

const MediaSchema = z.object({ url: z.string(), type: z.string(), name: z.string().optional() });
const Schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  mediaJson: z.array(MediaSchema).optional(),
  sysOrderIndex: z.number().int().optional(),
  parentClassId: z.string().min(1).nullable().optional(),
  nodeKind: z.enum(NODE_KINDS).optional(),
  contentMd: z.string().optional(),
  stepType: z.string().optional(),
  rawJson: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateClassInput = z.infer<typeof Schema> & { classId: string };

export const updateClassValidateInput = async (request: Request, param?: string): Promise<Result<string, UpdateClassInput>> => {
  if (!param) return fail('classId path param is required');
  let body: unknown;
  try { body = await request.json(); } catch { return fail('invalid JSON body'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join('; '));
  return succeed({ ...parsed.data, classId: param });
};
