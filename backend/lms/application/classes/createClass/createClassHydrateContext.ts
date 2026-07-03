import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../infrastructure/repositories/LmsCourseRepository.js';
import type { ClassRow } from '../../../infrastructure/repositories/LmsClassRepository.js';
import type { CreateClassInput } from './createClassValidateInput.js';

export interface CreateClassContext { input: CreateClassInput; course: CourseRow; parent: ClassRow | null; }

export const createClassHydrateContext = async (input: CreateClassInput, ctx: AuthoringContext): Promise<Result<'NOT_FOUND', CreateClassContext>> => {
  const course = await ctx.courseRepo.findById(input.courseId);
  if (!course) return fail('NOT_FOUND' as const);
  let parent: ClassRow | null = null;
  if (input.parentClassId) {
    parent = await ctx.classRepo.findById(input.parentClassId);
    if (!parent) return fail('NOT_FOUND' as const);
  }
  return succeed({ input, course, parent });
};
