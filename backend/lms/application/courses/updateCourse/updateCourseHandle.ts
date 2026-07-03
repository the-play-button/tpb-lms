import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { updateCourseValidateInput } from './updateCourseValidateInput.js';
import { updateCourseHydrateContext } from './updateCourseHydrateContext.js';
import { updateCourseValidateContext } from './updateCourseValidateContext.js';
import { updateCourseCheckPolicies } from './updateCourseCheckPolicies.js';
import { updateCourseExecute } from './updateCourseExecute.js';
import { updateCourseFilter, type CourseView } from './updateCourseFilter.js';
import { updateCourseTrack } from './updateCourseTrack.js';

export const updateCourseHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, CourseView>> => {
  const input = await updateCourseValidateInput(request, param);
  if (!input.ok) return fail(input.error);
  const context = await updateCourseHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = updateCourseValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = updateCourseCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await updateCourseExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = updateCourseFilter(executed.value);
  updateCourseTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
