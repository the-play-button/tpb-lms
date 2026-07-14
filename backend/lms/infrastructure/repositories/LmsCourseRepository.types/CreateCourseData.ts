export interface CreateCourseData {
  id: string;
  name: string;
  description?: string | null;
  categoriesJson?: unknown;
  mediaJson?: unknown;
  isPrivate?: boolean;
  languagesJson?: unknown;
  rawJson?: unknown;
}
