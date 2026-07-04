import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { CreateClassContext } from './createClassHydrateContext.js';

export const createClassExecute = async (context: CreateClassContext, ctx: AuthoringContext): Promise<Result<string, ClassRow>> => {
  const { input } = context;
  const id = input.id ?? `class_${crypto.randomUUID()}`;
  // Inline step content + step type live in raw_json.tpb_content_md /
  // tpb_step_type — that is the SSOT the viewer reads (CoursesService.enrichClass
  // maps raw.tpb_content_md / raw.tpb_step_type). The deprecated content_md /
  // step_type columns are never read, so we do NOT write them (§ ALWAYS FAIL
  // HARD — no dead write path). The creator stamp is always last so it cannot be
  // overwritten (§ actor stamping).
  const rawJson = {
    ...(input.rawJson ?? {}),
    ...(input.stepType ? { tpb_step_type: input.stepType } : {}),
    ...(input.contentMd ? { tpb_content_md: input.contentMd } : {}),
    tpb_created_by: ctx.actor.email ?? ctx.actor.id,
  };
  const row = await ctx.classRepo.insert({
    id, courseId: input.courseId, parentClassId: input.parentClassId ?? null,
    nodeKind: input.nodeKind, name: input.name, description: input.description ?? null,
    mediaJson: input.mediaJson, sysOrderIndex: input.sysOrderIndex,
    rawJson,
  });
  return succeed(row);
};
