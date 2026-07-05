import { succeed, type Result } from '../../../domain/core/Result.js';
import type { UpdateProgramContext } from './updateProgramHydrateContext.js';

export const updateProgramValidateContext = (_ctx: UpdateProgramContext): Result<string, void> => succeed(undefined);
