import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { createProgramValidateInput } from './createProgramValidateInput.js';
import { createProgramHydrateContext } from './createProgramHydrateContext.js';
import { createProgramValidateContext } from './createProgramValidateContext.js';
import { createProgramCheckPolicies } from './createProgramCheckPolicies.js';
import { createProgramExecute } from './createProgramExecute.js';
import { createProgramFilter, type ProgramView } from './createProgramFilter.js';
import { createProgramTrack } from './createProgramTrack.js';

export const createProgramHandle = async (request: Request, ctx: AuthoringContext, _param?: string): Promise<Result<string, ProgramView>> => {
  const input = await createProgramValidateInput(request);
  if (!input.ok) return fail(input.error);
  const context = await createProgramHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = createProgramValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = createProgramCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await createProgramExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = createProgramFilter(executed.value);
  createProgramTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
