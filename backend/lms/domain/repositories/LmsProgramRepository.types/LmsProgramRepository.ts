import type { ProgramRow } from './ProgramRow';
import type { CreateProgramData } from './CreateProgramData';
import type { UpdateProgramPatch } from './UpdateProgramPatch';

export interface LmsProgramRepository {
  findById(id: string): Promise<ProgramRow | null>;
  /** Idempotent by id (INSERT OR IGNORE); returns the row. */
  insert(data: CreateProgramData): Promise<ProgramRow>;
  update(id: string, patch: UpdateProgramPatch): Promise<void>;
  delete(id: string): Promise<void>;
}
