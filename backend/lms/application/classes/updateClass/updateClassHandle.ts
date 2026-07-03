import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { updateClassValidateInput } from './updateClassValidateInput.js';
import { updateClassHydrateContext } from './updateClassHydrateContext.js';
import { updateClassValidateContext } from './updateClassValidateContext.js';
import { updateClassCheckPolicies } from './updateClassCheckPolicies.js';
import { updateClassExecute } from './updateClassExecute.js';
import { updateClassFilter, type ClassView } from './updateClassFilter.js';
import { updateClassTrack } from './updateClassTrack.js';

export const updateClassHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, ClassView>> => {
  const input = await updateClassValidateInput(request, param);
  if (!input.ok) return fail(input.error);
  const context = await updateClassHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = updateClassValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = updateClassCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await updateClassExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = updateClassFilter(executed.value);
  updateClassTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
