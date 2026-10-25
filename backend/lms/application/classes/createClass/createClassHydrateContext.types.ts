import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { CreateClassInput } from './createClassValidateInput.js';

export interface CreateClassContext { input: CreateClassInput; course: CourseRow; parent: ClassRow | null; }
