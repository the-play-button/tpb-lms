import { fail, succeed, type Result } from '../../../domain/core/Result.js';

export interface DeleteCourseInput { courseId: string; }

export const deleteCourseValidateInput = async (_request: Request, param?: string): Promise<Result<string, DeleteCourseInput>> => {
  if (!param) return fail('courseId path param is required');
  return succeed({ courseId: param });
};
