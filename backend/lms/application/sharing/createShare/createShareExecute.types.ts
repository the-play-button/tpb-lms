import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email, ShareId } from '../../../domain/value-objects/index.js';
import { ActiveShare } from '../../../domain/entities/Share/ActiveShare.js';
import type { ShareRole } from '../../../domain/entities/ContentRef/SharedContentRef.js';
import { contentShared } from '../../../domain/events/events/ContentShared.js';
import type { ShareContentContext } from './createShareHydrateContext.js';
import type { ShareContentInput } from './createShareValidateInput.js';

export interface ShareContentOutput {
  share_id: string;
  content_ref_id: string;
  shared_with: string;
  role: string;
}
