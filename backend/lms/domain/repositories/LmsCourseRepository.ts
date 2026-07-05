/**
 * LmsCourseRepository — persistence port for lms_course (content-authoring).
 * Domain-owned interface; the D1 implementation lives in
 * infrastructure/repositories/LmsCourseDatabaseRepository.ts.
 */

export interface CourseRow {
  id: string;
  name: string;
  description: string | null;
  categories_json: string | null;
  media_json: string | null;
  is_active: number;
  is_private: number;
  languages_json: string | null;
  program_id: string | null;
  sys_order_index: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCourseData {
  id: string;
  name: string;
  description?: string | null;
  categoriesJson?: unknown;
  mediaJson?: unknown;
  isPrivate?: boolean;
  languagesJson?: unknown;
  sysOrderIndex?: number;
  rawJson?: unknown;
}

export interface UpdateCoursePatch {
  name?: string;
  description?: string | null;
  categoriesJson?: unknown;
  mediaJson?: unknown;
  isActive?: boolean;
  isPrivate?: boolean;
  languagesJson?: unknown;
  programId?: string | null;
  sysOrderIndex?: number;
  rawJson?: unknown;
}

export interface LmsCourseRepository {
  findById(id: string): Promise<CourseRow | null>;
  /** Idempotent by id (INSERT OR IGNORE); returns the row. */
  insert(data: CreateCourseData): Promise<CourseRow>;
  update(id: string, patch: UpdateCoursePatch): Promise<void>;
  delete(id: string): Promise<void>;
}
