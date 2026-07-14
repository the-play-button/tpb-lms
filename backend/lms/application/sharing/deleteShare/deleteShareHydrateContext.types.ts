import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ShareId } from '../../../domain/value-objects/index.js';

export interface RevokeShareContext {
  share: ActiveShare;
  contentRef: ContentRef;
  isOwner: boolean;
}
