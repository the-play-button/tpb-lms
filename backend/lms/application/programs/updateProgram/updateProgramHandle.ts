import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { updateProgramValidateInput } from './updateProgramValidateInput.js';
import { updateProgramHydrateContext } from './updateProgramHydrateContext.js';
import { updateProgramValidateContext } from './updateProgramValidateContext.js';
import { updateProgramCheckPolicies } from './updateProgramCheckPolicies.js';
import { updateProgramExecute } from './updateProgramExecute.js';
import { updateProgramFilter, type ProgramView } from './updateProgramFilter.js';
import { updateProgramTrack } from './updateProgramTrack.js';

export const updateProgramHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, ProgramView>> => {
  const input = await updateProgramValidateInput(request, param);
  if (!input.ok) return fail(input.error);
  const context = await updateProgramHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = updateProgramValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = updateProgramCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await updateProgramExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = updateProgramFilter(executed.value);
  updateProgramTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
