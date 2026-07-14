import type { NodeKind } from '../../NodeKind.js';

export interface UpdateClassPatch {
  name?: string;
  description?: string | null;
  mediaJson?: unknown;
  sysOrderIndex?: number;
  parentClassId?: string | null;
  nodeKind?: NodeKind;
  rawJson?: unknown;
}
