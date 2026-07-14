export interface UpdateCoursePatch {
  name?: string;
  description?: string | null;
  categoriesJson?: unknown;
  mediaJson?: unknown;
  isActive?: boolean;
  isPrivate?: boolean;
  languagesJson?: unknown;
  rawJson?: unknown;
}
