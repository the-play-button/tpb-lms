import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';

export interface ListPermissionsContext {
  contentRef: ContentRef;
  shares: ActiveShare[];
  isOwner: boolean;
}
