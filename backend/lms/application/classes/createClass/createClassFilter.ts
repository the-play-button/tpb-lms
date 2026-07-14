import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';

import type { ClassView } from './createClassFilter.types';
export type { ClassView };



export const createClassFilter = (row: ClassRow): ClassView => ({
  id: row.id, course_id: row.course_id, parent_class_id: row.parent_class_id,
  node_kind: row.node_kind, name: row.name, description: row.description,
  media: row.media_json ? JSON.parse(row.media_json) : [], order_index: row.sys_order_index,
});
