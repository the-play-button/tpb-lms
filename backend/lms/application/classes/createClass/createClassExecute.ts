import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../infrastructure/repositories/LmsClassRepository.js';
import type { CreateClassContext } from './createClassHydrateContext.js';

export const createClassExecute = async (context: CreateClassContext, ctx: AuthoringContext): Promise<Result<string, ClassRow>> => {
  const { input } = context;
  const id = input.id ?? `class_${crypto.randomUUID()}`;
  const row = await ctx.classRepo.insert({
    id, courseId: input.courseId, parentClassId: input.parentClassId ?? null,
    nodeKind: input.nodeKind, name: input.name, description: input.description ?? null,
    mediaJson: input.mediaJson, sysOrderIndex: input.sysOrderIndex,
    rawJson: { tpb_created_by: ctx.actor.email ?? ctx.actor.id },
  });
  return succeed(row);
};
