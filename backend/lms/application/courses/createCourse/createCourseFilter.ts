import type { CourseRow } from '../../../domain/repositories/LmsCourseRepository.js';

import type { CourseView } from './createCourseFilter.types';
export type { CourseView };



export const createCourseFilter = (row: CourseRow): CourseView => ({
  id: row.id, name: row.name, description: row.description,
  categories: row.categories_json ? JSON.parse(row.categories_json) : [],
  media: row.media_json ? JSON.parse(row.media_json) : [],
  is_active: row.is_active === 1, is_private: row.is_private === 1,
});
