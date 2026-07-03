import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { deleteClassValidateInput } from './deleteClassValidateInput.js';
import { deleteClassHydrateContext } from './deleteClassHydrateContext.js';
import { deleteClassValidateContext } from './deleteClassValidateContext.js';
import { deleteClassCheckPolicies } from './deleteClassCheckPolicies.js';
import { deleteClassExecute } from './deleteClassExecute.js';
import { deleteClassFilter, type DeletedView } from './deleteClassFilter.js';
import { deleteClassTrack } from './deleteClassTrack.js';

export const deleteClassHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, DeletedView>> => {
  const input = await deleteClassValidateInput(request, param);
  if (!input.ok) return fail(input.error);
  const context = await deleteClassHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = deleteClassValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = deleteClassCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await deleteClassExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = deleteClassFilter(executed.value);
  deleteClassTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
