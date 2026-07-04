/**
 * LmsClassRepository — persistence port for lms_class (adjacency-list tree,
 * Plan 03). Domain-owned interface; the D1 implementation lives in
 * infrastructure/repositories/LmsClassDatabaseRepository.ts.
 */
import type { NodeKind } from '../NodeKind.js';

export type { NodeKind };

export interface ClassRow {
  id: string;
  course_id: string;
  parent_class_id: string | null;
  node_kind: NodeKind;
  name: string;
  description: string | null;
  media_json: string | null;
  sys_order_index: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClassData {
  id: string;
  courseId: string;
  parentClassId?: string | null;
  nodeKind: NodeKind;
  name: string;
  description?: string | null;
  mediaJson?: unknown;
  sysOrderIndex?: number;
  rawJson?: unknown;
}

export interface UpdateClassPatch {
  name?: string;
  description?: string | null;
  mediaJson?: unknown;
  sysOrderIndex?: number;
  parentClassId?: string | null;
  nodeKind?: NodeKind;
  rawJson?: unknown;
}

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
