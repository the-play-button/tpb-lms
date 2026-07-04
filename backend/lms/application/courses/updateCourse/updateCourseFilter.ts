import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';

export interface CourseView {
  id: string; name: string; description: string | null;
  categories: unknown; media: unknown; is_active: boolean; is_private: boolean;
}

export const updateCourseFilter = (row: CourseRow): CourseView => ({
  id: row.id, name: row.name, description: row.description,
  categories: row.categories_json ? JSON.parse(row.categories_json) : [],
  media: row.media_json ? JSON.parse(row.media_json) : [],
  is_active: row.is_active === 1, is_private: row.is_private === 1,
});
