import { succeed, type Result } from '../../../domain/core/Result.js';
import type { DeleteCourseContext } from './deleteCourseHydrateContext.js';

export const deleteCourseValidateContext = (_ctx: DeleteCourseContext): Result<string, void> => succeed(undefined);
