import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { deleteCourseValidateInput } from './deleteCourseValidateInput.js';
import { deleteCourseHydrateContext } from './deleteCourseHydrateContext.js';
import { deleteCourseValidateContext } from './deleteCourseValidateContext.js';
import { deleteCourseCheckPolicies } from './deleteCourseCheckPolicies.js';
import { deleteCourseExecute } from './deleteCourseExecute.js';
import { deleteCourseFilter, type DeletedView } from './deleteCourseFilter.js';
import { deleteCourseTrack } from './deleteCourseTrack.js';

export const deleteCourseHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, DeletedView>> => {
  const input = await deleteCourseValidateInput(request, param);
  if (!input.ok) return fail(input.error);
  const context = await deleteCourseHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = deleteCourseValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = deleteCourseCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await deleteCourseExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = deleteCourseFilter(executed.value);
  deleteCourseTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
