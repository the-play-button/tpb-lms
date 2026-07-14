import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email } from '../../../domain/value-objects/index.js';
import { shareRevoked } from '../../../domain/events/events/ShareRevoked.js';
import type { RevokeShareContext } from './deleteShareHydrateContext.js';

export interface RevokeShareOutput {
  share_id: string;
  content_ref_id: string;
  revoked_at: string;
}
