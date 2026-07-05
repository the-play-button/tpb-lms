import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';

export interface ProgramView {
  id: string; name: string; description: string | null; media: unknown; is_active: boolean;
}

export const updateProgramFilter = (row: ProgramRow): ProgramView => ({
  id: row.id, name: row.name, description: row.description,
  media: row.media_json ? JSON.parse(row.media_json) : [],
  is_active: row.is_active === 1,
});
