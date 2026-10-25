import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { DeleteCourseInput } from './deleteCourseValidateInput.js';

export interface DeleteCourseContext { input: DeleteCourseInput; course: CourseRow; }
