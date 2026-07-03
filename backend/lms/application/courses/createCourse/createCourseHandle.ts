import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { createCourseValidateInput } from './createCourseValidateInput.js';
import { createCourseHydrateContext } from './createCourseHydrateContext.js';
import { createCourseValidateContext } from './createCourseValidateContext.js';
import { createCourseCheckPolicies } from './createCourseCheckPolicies.js';
import { createCourseExecute } from './createCourseExecute.js';
import { createCourseFilter, type CourseView } from './createCourseFilter.js';
import { createCourseTrack } from './createCourseTrack.js';

export const createCourseHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, CourseView>> => {
  const input = await createCourseValidateInput(request);
  if (!input.ok) return fail(input.error);
  const context = await createCourseHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = createCourseValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = createCourseCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await createCourseExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = createCourseFilter(executed.value);
  createCourseTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
