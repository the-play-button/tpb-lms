import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';

export interface RevokeShareContext {
  share: ActiveShare;
  contentRef: ContentRef;
  isOwner: boolean;
}
