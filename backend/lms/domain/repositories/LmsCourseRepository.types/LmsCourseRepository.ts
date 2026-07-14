import type { CourseRow } from './CourseRow';
import type { CreateCourseData } from './CreateCourseData';
import type { UpdateCoursePatch } from './UpdateCoursePatch';

export interface LmsCourseRepository {
  findById(id: string): Promise<CourseRow | null>;
  /** Idempotent by id (INSERT OR IGNORE); returns the row. */
  insert(data: CreateCourseData): Promise<CourseRow>;
  update(id: string, patch: UpdateCoursePatch): Promise<void>;
  delete(id: string): Promise<void>;
}
