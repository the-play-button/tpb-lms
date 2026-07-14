import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';

export interface CourseView {
  id: string; name: string; description: string | null;
  categories: unknown; media: unknown; is_active: boolean; is_private: boolean;
}
