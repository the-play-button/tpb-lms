import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';

export interface ClassView {
  id: string; course_id: string; parent_class_id: string | null;
  node_kind: string; name: string; description: string | null;
  media: unknown; order_index: number;
}

export const updateClassFilter = (row: ClassRow): ClassView => ({
  id: row.id, course_id: row.course_id, parent_class_id: row.parent_class_id,
  node_kind: row.node_kind, name: row.name, description: row.description,
  media: row.media_json ? JSON.parse(row.media_json) : [], order_index: row.sys_order_index,
});
