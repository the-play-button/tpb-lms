import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { UpdateCourseInput } from './updateCourseValidateInput.js';

import type { UpdateCourseContext } from './updateCourseHydrateContext.types';
export type { UpdateCourseContext };



export const updateCourseHydrateContext = async (input: UpdateCourseInput, ctx: AuthoringContext): Promise<Result<'NOT_FOUND', UpdateCourseContext>> => {
  const course = await ctx.courseRepo.findById(input.courseId);
  if (!course) return fail('NOT_FOUND' as const);
  return succeed({ input, course });
};
