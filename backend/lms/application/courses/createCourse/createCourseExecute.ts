import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { CreateCourseContext } from './createCourseHydrateContext.js';

export const createCourseExecute = async (context: CreateCourseContext, ctx: AuthoringContext): Promise<Result<string, CourseRow>> => {
  const { input } = context;
  const id = input.id ?? `course_${crypto.randomUUID()}`;
  const row = await ctx.courseRepo.insert({
    id, name: input.name, description: input.description ?? null,
    categoriesJson: input.categoriesJson, mediaJson: input.mediaJson,
    isPrivate: input.isPrivate, languagesJson: input.languagesJson,
    rawJson: { tpb_created_by: ctx.actor.email ?? ctx.actor.id },
  });
  return succeed(row);
};
