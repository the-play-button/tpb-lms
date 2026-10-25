import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { DeleteClassInput } from './deleteClassValidateInput.js';

export interface DeleteClassContext { input: DeleteClassInput; current: ClassRow; }
