import { fail, succeed, type Result } from '../../../domain/core/Result.js';

export interface DeleteClassInput { classId: string; }

export const deleteClassValidateInput = async (_request: Request, param?: string): Promise<Result<string, DeleteClassInput>> => {
  if (!param) return fail('classId path param is required');
  return succeed({ classId: param });
};
