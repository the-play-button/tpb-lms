import { succeed, fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { UpdateClassContext } from './updateClassHydrateContext.js';

export const updateClassExecute = async (context: UpdateClassContext, ctx: AuthoringContext): Promise<Result<string, ClassRow>> => {
  const { input } = context;

  // Inline content / step type live in raw_json.tpb_content_md / tpb_step_type
  // (the SSOT the viewer reads). Read-modify-write merge so we never drop keys
  // already stored (tpb_created_by, etc.). Only computed when the caller touches
  // one of them, otherwise raw_json is left untouched.
  let rawJson: Record<string, unknown> | undefined;
  if (input.rawJson !== undefined || input.contentMd !== undefined || input.stepType !== undefined) {
    const existing = await ctx.classRepo.findById(input.classId);
    if (!existing) return fail('NOT_FOUND');
    const current = existing.raw_json ? (JSON.parse(existing.raw_json) as Record<string, unknown>) : {};
    rawJson = {
      ...current,
      ...(input.rawJson ?? {}),
      ...(input.stepType ? { tpb_step_type: input.stepType } : {}),
      ...(input.contentMd ? { tpb_content_md: input.contentMd } : {}),
    };
  }

  await ctx.classRepo.update(input.classId, {
    name: input.name, description: input.description, mediaJson: input.mediaJson,
    sysOrderIndex: input.sysOrderIndex, parentClassId: input.parentClassId, nodeKind: input.nodeKind,
    rawJson,
  });
  const row = await ctx.classRepo.findById(input.classId);
  if (!row) return fail('NOT_FOUND');
  return succeed(row);
};
