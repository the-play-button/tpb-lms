import { succeed, type Result } from '../../../domain/core/Result.js';
import type { DeleteClassContext } from './deleteClassHydrateContext.js';

export const deleteClassValidateContext = (_ctx: DeleteClassContext): Result<string, void> => succeed(undefined);
