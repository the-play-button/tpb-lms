import { succeed, type Result } from '../../../domain/core/Result.js';
import type { CreateProgramContext } from './createProgramHydrateContext.js';

export const createProgramValidateContext = (_ctx: CreateProgramContext): Result<string, void> => succeed(undefined);
