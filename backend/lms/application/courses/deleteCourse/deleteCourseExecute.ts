import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { DeleteCourseContext } from './deleteCourseHydrateContext.js';
import type { DeletedView } from './deleteCourseFilter.js';

export const deleteCourseExecute = async (context: DeleteCourseContext, ctx: AuthoringContext): Promise<Result<string, DeletedView>> => {
  const { courseId } = context.input;
  await ctx.classRepo.deleteByCourse(courseId);
  await ctx.courseRepo.delete(courseId);
  return succeed({ id: courseId, deleted: true });
};
