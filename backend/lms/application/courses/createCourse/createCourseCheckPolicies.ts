import { hasScope } from '@the-play-button/tpb-sdk-js';
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';

const REQUIRED_SCOPE = 'lms:course:write';

export const createCourseCheckPolicies = (ctx: AuthoringContext): Result<'FORBIDDEN', 'allowed'> =>
  hasScope(ctx.actor.scopes ?? [], REQUIRED_SCOPE) ? succeed('allowed' as const) : fail('FORBIDDEN' as const);
