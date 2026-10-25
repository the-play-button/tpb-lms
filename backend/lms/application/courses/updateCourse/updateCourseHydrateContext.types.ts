import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { UpdateCourseInput } from './updateCourseValidateInput.js';

export interface UpdateCourseContext { input: UpdateCourseInput; course: CourseRow; }
