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
