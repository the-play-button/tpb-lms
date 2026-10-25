import type { FilteredContentRef } from './FilteredContentRef';

export interface FullContentRef extends FilteredContentRef {
  connectionId: string;
  ownerEmail: string;
  sourceRefId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
