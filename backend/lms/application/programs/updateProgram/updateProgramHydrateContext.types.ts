import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';
import type { UpdateProgramInput } from './updateProgramValidateInput.js';

export interface UpdateProgramContext { input: UpdateProgramInput; program: ProgramRow; }
