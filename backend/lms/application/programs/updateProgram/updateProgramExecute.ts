import { succeed, fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';
import type { UpdateProgramContext } from './updateProgramHydrateContext.js';

export const updateProgramExecute = async (context: UpdateProgramContext, ctx: AuthoringContext): Promise<Result<string, ProgramRow>> => {
  const { input } = context;

  // rawJson → read-modify-write merge so we never drop keys already stored
  // (e.g. tpb_created_by). Only computed when the caller touches rawJson.
  let rawJson: Record<string, unknown> | undefined;
  if (input.rawJson !== undefined) {
    const existing = await ctx.programRepo.findById(input.programId);
    if (!existing) return fail('NOT_FOUND');
    const current = existing.raw_json ? (JSON.parse(existing.raw_json) as Record<string, unknown>) : {};
    rawJson = { ...current, ...input.rawJson };
  }

  await ctx.programRepo.update(input.programId, {
    name: input.name, description: input.description,
    mediaJson: input.mediaJson, isActive: input.isActive, rawJson,
  });
  const row = await ctx.programRepo.findById(input.programId);
  if (!row) return fail('NOT_FOUND');
  return succeed(row);
};
