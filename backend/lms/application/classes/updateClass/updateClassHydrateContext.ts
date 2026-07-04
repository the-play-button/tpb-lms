import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { UpdateClassInput } from './updateClassValidateInput.js';

export interface UpdateClassContext { input: UpdateClassInput; current: ClassRow; parent: ClassRow | null; subtreeIds: string[]; }

export const updateClassHydrateContext = async (input: UpdateClassInput, ctx: AuthoringContext): Promise<Result<'NOT_FOUND', UpdateClassContext>> => {
  const current = await ctx.classRepo.findById(input.classId);
  if (!current) return fail('NOT_FOUND' as const);
  let parent: ClassRow | null = null;
  if (input.parentClassId) {
    parent = await ctx.classRepo.findById(input.parentClassId);
    if (!parent) return fail('NOT_FOUND' as const);
  }
  // Descendants of the node being moved (cycle detection in ValidateContext).
  const subtreeIds = input.parentClassId ? await ctx.classRepo.collectSubtreeIds(input.classId) : [];
  return succeed({ input, current, parent, subtreeIds });
};
