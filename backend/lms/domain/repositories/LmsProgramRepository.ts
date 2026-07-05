/**
 * LmsProgramRepository — persistence port for lms_program (Plan 10), the grouping
 * level above lms_course (Program → Course → Section → Lesson). Domain-owned
 * interface; the D1 implementation lives in infrastructure/repositories/.
 */

export interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
  media_json: string | null;
  is_active: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProgramData {
  id: string;
  name: string;
  description?: string | null;
  mediaJson?: unknown;
  rawJson?: unknown;
}

export interface UpdateProgramPatch {
  name?: string;
  description?: string | null;
  mediaJson?: unknown;
  isActive?: boolean;
  rawJson?: unknown;
}

export interface LmsProgramRepository {
  findById(id: string): Promise<ProgramRow | null>;
  /** Idempotent by id (INSERT OR IGNORE); returns the row. */
  insert(data: CreateProgramData): Promise<ProgramRow>;
  update(id: string, patch: UpdateProgramPatch): Promise<void>;
  delete(id: string): Promise<void>;
}
