import { succeed, fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { UpdateCourseContext } from './updateCourseHydrateContext.js';

export const updateCourseExecute = async (context: UpdateCourseContext, ctx: AuthoringContext): Promise<Result<string, CourseRow>> => {
  const { input } = context;

  // rawJson / progressionMode → read-modify-write merge so we never drop keys
  // already stored (e.g. tpb_created_by). Only computed when the caller touches
  // either, otherwise raw_json is left untouched.
  let rawJson: Record<string, unknown> | undefined;
  if (input.rawJson !== undefined || input.progressionMode !== undefined) {
    const existing = await ctx.courseRepo.findById(input.courseId);
    if (!existing) return fail('NOT_FOUND');
    const current = existing.raw_json ? (JSON.parse(existing.raw_json) as Record<string, unknown>) : {};
    rawJson = {
      ...current,
      ...(input.rawJson ?? {}),
      ...(input.progressionMode ? { tpb_progression_mode: input.progressionMode } : {}),
    };
  }

  await ctx.courseRepo.update(input.courseId, {
    name: input.name, description: input.description,
    categoriesJson: input.categoriesJson, mediaJson: input.mediaJson,
    isActive: input.isActive, isPrivate: input.isPrivate, languagesJson: input.languagesJson,
    programId: input.programId, sysOrderIndex: input.sysOrderIndex, rawJson,
  });
  const row = await ctx.courseRepo.findById(input.courseId);
  if (!row) return fail('NOT_FOUND');
  return succeed(row);
};
