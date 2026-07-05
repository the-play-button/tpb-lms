import { succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { CreateProgramInput } from './createProgramValidateInput.js';

export interface CreateProgramContext { input: CreateProgramInput; }

export const createProgramHydrateContext = async (input: CreateProgramInput, _ctx: AuthoringContext): Promise<Result<string, CreateProgramContext>> =>
  succeed({ input });
