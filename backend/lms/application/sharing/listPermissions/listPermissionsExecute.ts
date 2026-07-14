import { succeed, type Result } from '../../../domain/core/Result.js';
import type { ListPermissionsContext } from './listPermissionsHydrateContext.js';

import type { PermissionEntry } from './listPermissionsExecute.types/PermissionEntry';
import type { ListPermissionsOutput } from './listPermissionsExecute.types/ListPermissionsOutput';
export type { PermissionEntry };
export type { ListPermissionsOutput };




/**
 * Execute step: map active shares to permission entries.
 */
export const listPermissionsExecute = (context: ListPermissionsContext): Result<string, ListPermissionsOutput> => {
  const permissions: PermissionEntry[] = context.shares.map<PermissionEntry>((s) => ({
    id: s.id.value,
    shared_with: s.sharedWithEmail.value,
    role: s.role === 'editor' ? 'WRITE' : 'READ',
    created_at: s.createdAt.toISOString(),
  }));

  return succeed({
    content_ref_id: context.contentRef.id.value,
    owner_email: context.contentRef.ownerEmail.value,
    permissions,
  });
};
