import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';
import type { UpdateProgramInput } from './updateProgramValidateInput.js';

export interface UpdateProgramContext { input: UpdateProgramInput; program: ProgramRow; }

export const updateProgramHydrateContext = async (input: UpdateProgramInput, ctx: AuthoringContext): Promise<Result<'NOT_FOUND', UpdateProgramContext>> => {
  const program = await ctx.programRepo.findById(input.programId);
  if (!program) return fail('NOT_FOUND' as const);
  return succeed({ input, program });
};
