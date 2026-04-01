// entropy-multiple-exports-ok: cohesive module exports
import { succeed, type Result } from '../../../domain/core/Result.js';
import type { ListPermissionsContext } from './listPermissionsHydrateContext.js';

export interface PermissionEntry {
  id: string;
  shared_with: string;
  role: string;
  created_at: string;
}

export interface ListPermissionsOutput {
  content_ref_id: string;
  owner_email: string;
  permissions: PermissionEntry[];
}

/**
 * Execute step: map active shares to permission entries.
 */
export const listPermissionsExecute = (context: ListPermissionsContext): Result<string, ListPermissionsOutput> => {
  const permissions: PermissionEntry[] = context.shares.map((s) => ({
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
