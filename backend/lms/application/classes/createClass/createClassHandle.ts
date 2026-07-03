import { fail, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { createClassValidateInput } from './createClassValidateInput.js';
import { createClassHydrateContext } from './createClassHydrateContext.js';
import { createClassValidateContext } from './createClassValidateContext.js';
import { createClassCheckPolicies } from './createClassCheckPolicies.js';
import { createClassExecute } from './createClassExecute.js';
import { createClassFilter, type ClassView } from './createClassFilter.js';
import { createClassTrack } from './createClassTrack.js';

export const createClassHandle = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Result<string, ClassView>> => {
  const input = await createClassValidateInput(request);
  if (!input.ok) return fail(input.error);
  const context = await createClassHydrateContext(input.value, ctx);
  if (!context.ok) return fail(context.error);
  const validated = createClassValidateContext(context.value);
  if (!validated.ok) return fail(validated.error);
  const policy = createClassCheckPolicies(ctx);
  if (!policy.ok) return fail(policy.error);
  const executed = await createClassExecute(context.value, ctx);
  if (!executed.ok) return fail(executed.error);
  const view = createClassFilter(executed.value);
  createClassTrack(ctx.actor, view.id);
  return { ok: true, value: view };
};
