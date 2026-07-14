import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import type { ListPermissionsValidatedInput } from './listPermissionsValidateInput.js';

export interface ListPermissionsContext {
  contentRef: ContentRef;
  shares: ActiveShare[];
  isOwner: boolean;
}
