import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';

export interface ProgramView {
  id: string; name: string; description: string | null; media: unknown; is_active: boolean;
}
