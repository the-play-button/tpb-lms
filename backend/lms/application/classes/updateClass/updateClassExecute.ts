import { succeed, fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { UpdateClassContext } from './updateClassHydrateContext.js';

export const updateClassExecute = async (context: UpdateClassContext, ctx: AuthoringContext): Promise<Result<string, ClassRow>> => {
  const { input } = context;
  await ctx.classRepo.update(input.classId, {
    name: input.name, description: input.description, mediaJson: input.mediaJson,
    sysOrderIndex: input.sysOrderIndex, parentClassId: input.parentClassId, nodeKind: input.nodeKind,
  });
  const row = await ctx.classRepo.findById(input.classId);
  if (!row) return fail('NOT_FOUND');
  return succeed(row);
};
