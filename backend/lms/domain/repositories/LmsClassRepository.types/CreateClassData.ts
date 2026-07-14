import type { NodeKind } from '../../NodeKind.js';

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
