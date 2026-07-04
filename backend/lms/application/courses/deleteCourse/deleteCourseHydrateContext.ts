import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { DeleteCourseInput } from './deleteCourseValidateInput.js';

export interface DeleteCourseContext { input: DeleteCourseInput; course: CourseRow; }

export const deleteCourseHydrateContext = async (input: DeleteCourseInput, ctx: AuthoringContext): Promise<Result<'NOT_FOUND', DeleteCourseContext>> => {
  const course = await ctx.courseRepo.findById(input.courseId);
  if (!course) return fail('NOT_FOUND' as const);
  return succeed({ input, course });
};
