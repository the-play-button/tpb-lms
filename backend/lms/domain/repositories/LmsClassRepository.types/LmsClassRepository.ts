import type { NodeKind } from '../../NodeKind.js';
import type { ClassRow } from './ClassRow';
import type { CreateClassData } from './CreateClassData';
import type { UpdateClassPatch } from './UpdateClassPatch';

export interface LmsClassRepository {
  findById(id: string): Promise<ClassRow | null>;
  findByCourse(courseId: string): Promise<ClassRow[]>;
  /** Idempotent by id (INSERT OR IGNORE); returns the row. */
  insert(data: CreateClassData): Promise<ClassRow>;
  update(id: string, patch: UpdateClassPatch): Promise<void>;
  /** Collect a node + all its descendants (recursive CTE). */
  collectSubtreeIds(id: string): Promise<string[]>;
  /** Delete a node and its entire subtree; returns the row count deleted. */
  deleteSubtree(id: string): Promise<number>;
  deleteByCourse(courseId: string): Promise<void>;
}
