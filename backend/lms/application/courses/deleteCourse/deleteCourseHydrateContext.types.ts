import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { DeleteCourseInput } from './deleteCourseValidateInput.js';

export interface DeleteCourseContext { input: DeleteCourseInput; course: CourseRow; }
