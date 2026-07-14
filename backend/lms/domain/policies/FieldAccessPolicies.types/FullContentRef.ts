import type { Email } from '../../value-objects/index.js';
import type { DraftContentRef } from '../../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../../entities/ContentRef/SharedContentRef.js';
import type { ContentType, ContentUsage } from '../../entities/ContentRef/types.js';
import type { FilteredContentRef } from './FilteredContentRef';

export interface FullContentRef extends FilteredContentRef {
  connectionId: string;
  ownerEmail: string;
  sourceRefId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
