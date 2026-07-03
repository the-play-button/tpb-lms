import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { DeleteClassContext } from './deleteClassHydrateContext.js';
import type { DeletedView } from './deleteClassFilter.js';

export const deleteClassExecute = async (context: DeleteClassContext, ctx: AuthoringContext): Promise<Result<string, DeletedView>> => {
  const { classId } = context.input;
  const count = await ctx.classRepo.deleteSubtree(classId);
  return succeed({ id: classId, deleted: true, subtree_count: count });
};
