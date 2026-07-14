/**
 * LmsClassRepository — persistence port for lms_class (adjacency-list tree,
 * Plan 03). Domain-owned interface; the D1 implementation lives in
 * infrastructure/repositories/LmsClassDatabaseRepository.ts.
 */
import type { NodeKind } from '../NodeKind.js';

import type { ClassRow } from './LmsClassRepository.types/ClassRow';
import type { CreateClassData } from './LmsClassRepository.types/CreateClassData';
import type { UpdateClassPatch } from './LmsClassRepository.types/UpdateClassPatch';
import type { LmsClassRepository } from './LmsClassRepository.types/LmsClassRepository';
export type { ClassRow };
export type { CreateClassData };
export type { UpdateClassPatch };
export type { LmsClassRepository };


export type { NodeKind };




