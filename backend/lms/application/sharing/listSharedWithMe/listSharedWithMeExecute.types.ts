import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { Email } from '../../../domain/value-objects/index.js';
import type { SharedWithMeValidatedInput } from './listSharedWithMeValidateInput.js';

export interface SharedWithMeEntry {
  id: string;
  content_ref_id: string;
  shared_by: string;
  role: string;
  name: string;
  content_type: string;
  created_at: string;
}
