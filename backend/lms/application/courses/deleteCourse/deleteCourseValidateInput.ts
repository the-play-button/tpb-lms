import { fail, succeed, type Result } from '../../../domain/core/Result.js';

import type { DeleteCourseInput } from './deleteCourseValidateInput.types';
export type { DeleteCourseInput };



export const deleteCourseValidateInput = async (_request: Request, param?: string): Promise<Result<string, DeleteCourseInput>> => {
  if (!param) return fail('courseId path param is required');
  return succeed({ courseId: param });
};
