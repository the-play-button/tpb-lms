import { filterFields } from '../../filters/FieldSecurityFilter.js';
import type { ListPermissionsOutput, PermissionEntry } from './listPermissionsExecute.js';

/**
 * Filter step: apply FLS to permission entries.
 */
export const listPermissionsFilter = (output: ListPermissionsOutput, viewerEmail: string, ownerEmail: string): ListPermissionsOutput => {
  const filteredPermissions = output.permissions.map((p) =>
    filterFields(
      p as unknown as Record<string, unknown>,
      viewerEmail,
      ownerEmail
    )
  ) as unknown as PermissionEntry[];

  return {
    content_ref_id: output.content_ref_id,
    owner_email: output.owner_email,
    permissions: filteredPermissions,
  };
};
