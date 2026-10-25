import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';
import type { UpdateClassInput } from './updateClassValidateInput.js';

export interface UpdateClassContext { input: UpdateClassInput; current: ClassRow; parent: ClassRow | null; subtreeIds: string[]; }
