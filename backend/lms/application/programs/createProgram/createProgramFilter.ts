import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';

import type { ProgramView } from './createProgramFilter.types';
export type { ProgramView };



export const createProgramFilter = (row: ProgramRow): ProgramView => ({
  id: row.id, name: row.name, description: row.description,
  media: row.media_json ? JSON.parse(row.media_json) : [],
  is_active: row.is_active === 1,
});
