import { succeed, type Result } from '../../../domain/core/Result.js';
import type { CreateCourseContext } from './createCourseHydrateContext.js';

export const createCourseValidateContext = (_ctx: CreateCourseContext): Result<string, void> => succeed(undefined);
