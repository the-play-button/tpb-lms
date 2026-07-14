import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { DeleteClassInput } from './deleteClassValidateInput.js';

export interface DeleteClassContext { input: DeleteClassInput; current: ClassRow; }
