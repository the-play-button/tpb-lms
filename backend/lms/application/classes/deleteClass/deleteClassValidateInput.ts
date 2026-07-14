import { fail, succeed, type Result } from '../../../domain/core/Result.js';

import type { DeleteClassInput } from './deleteClassValidateInput.types';
export type { DeleteClassInput };



export const deleteClassValidateInput = async (_request: Request, param?: string): Promise<Result<string, DeleteClassInput>> => {
  if (!param) return fail('classId path param is required');
  return succeed({ classId: param });
};
