import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.types.js';
import type { CreateProgramInput } from './createProgramValidateInput.js';

export interface CreateProgramContext { input: CreateProgramInput; }
