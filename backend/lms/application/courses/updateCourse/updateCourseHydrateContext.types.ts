import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { UpdateCourseInput } from './updateCourseValidateInput.js';

export interface UpdateCourseContext { input: UpdateCourseInput; course: CourseRow; }
