import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';
import type { CreateProgramContext } from './createProgramHydrateContext.js';

export const createProgramExecute = async (context: CreateProgramContext, ctx: AuthoringContext): Promise<Result<string, ProgramRow>> => {
  const { input } = context;
  const id = input.id ?? `program_${crypto.randomUUID()}`;
  // Creator stamp is always last so a caller rawJson cannot overwrite it (§ actor stamping).
  const rawJson = { ...(input.rawJson ?? {}), tpb_created_by: ctx.actor.email ?? ctx.actor.id };
  const row = await ctx.programRepo.insert({
    id, name: input.name, description: input.description ?? null,
    mediaJson: input.mediaJson, rawJson,
  });
  return succeed(row);
};
