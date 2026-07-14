import { succeed, type Result } from '../../../../domain/core/Result.js';
import type { ListPermissionsContext } from '../listPermissionsHydrateContext.js';

export interface PermissionEntry {
  id: string;
  shared_with: string;
  role: string;
  created_at: string;
}
