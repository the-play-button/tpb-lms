import { succeed, type Result } from '../../../../domain/core/Result.js';
import type { ListPermissionsContext } from '../listPermissionsHydrateContext.js';
import type { PermissionEntry } from './PermissionEntry';

export interface ListPermissionsOutput {
  content_ref_id: string;
  owner_email: string;
  permissions: PermissionEntry[];
}
