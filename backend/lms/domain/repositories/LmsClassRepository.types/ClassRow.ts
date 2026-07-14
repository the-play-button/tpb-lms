import type { NodeKind } from '../../NodeKind.js';

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
