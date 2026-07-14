import type { ClassRow } from '../../../domain/repositories/LmsClassRepository.js';

export interface ClassView {
  id: string; course_id: string; parent_class_id: string | null;
  node_kind: string; name: string; description: string | null;
  media: unknown; order_index: number;
}
