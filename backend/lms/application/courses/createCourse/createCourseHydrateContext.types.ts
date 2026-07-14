import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CreateCourseInput } from './createCourseValidateInput.js';

export interface CreateCourseContext { input: CreateCourseInput; }
