import { succeed, type Result } from '../../../domain/core/Result.js';
import type { UpdateCourseContext } from './updateCourseHydrateContext.js';

export const updateCourseValidateContext = (_ctx: UpdateCourseContext): Result<string, void> => succeed(undefined);
