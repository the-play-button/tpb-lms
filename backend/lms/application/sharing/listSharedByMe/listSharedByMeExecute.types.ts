import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email } from '../../../domain/value-objects/index.js';
import type { SharedByMeValidatedInput } from './listSharedByMeValidateInput.js';

export interface SharedByMeEntry {
  id: string;
  content_ref_id: string;
  shared_with: string;
  role: string;
  created_at: string;
}
