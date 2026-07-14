import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { DeleteClassInput } from './deleteClassValidateInput.js';

import type { DeleteClassContext } from './deleteClassHydrateContext.types';
export type { DeleteClassContext };



export const deleteClassHydrateContext = async (input: DeleteClassInput, ctx: AuthoringContext): Promise<Result<'NOT_FOUND', DeleteClassContext>> => {
  const current = await ctx.classRepo.findById(input.classId);
  if (!current) return fail('NOT_FOUND' as const);
  return succeed({ input, current });
};
