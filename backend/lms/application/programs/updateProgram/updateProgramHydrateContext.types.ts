import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ProgramRow } from '../../../domain/repositories/LmsProgramRepository.js';
import type { UpdateProgramInput } from './updateProgramValidateInput.js';

export interface UpdateProgramContext { input: UpdateProgramInput; program: ProgramRow; }
