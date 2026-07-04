import { succeed, fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { UpdateCourseContext } from './updateCourseHydrateContext.js';

export const updateCourseExecute = async (context: UpdateCourseContext, ctx: AuthoringContext): Promise<Result<string, CourseRow>> => {
  const { input } = context;
  await ctx.courseRepo.update(input.courseId, {
    name: input.name, description: input.description,
    categoriesJson: input.categoriesJson, mediaJson: input.mediaJson,
    isActive: input.isActive, isPrivate: input.isPrivate, languagesJson: input.languagesJson,
  });
  const row = await ctx.courseRepo.findById(input.courseId);
  if (!row) return fail('NOT_FOUND');
  return succeed(row);
};
