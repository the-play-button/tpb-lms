/**
 * Filter — applies FLS to each permission entry then projects to the
 * canonical wire shape via listPermissionsToWire (= shape SSOT per
 * ddd_structural_patterns.md § 2.9).
 */
import { filterFields } from '../../../domain/policies/FieldSecurityFilter.js';
import type { ListPermissionsOutput, PermissionEntry } from './listPermissionsExecute.js';

/** Named wire-shape projection : canonical ListPermissions output. */
const listPermissionsToWire = (
  output: ListPermissionsOutput,
  filteredPermissions: PermissionEntry[],
): ListPermissionsOutput => ({
  content_ref_id: output.content_ref_id,
  owner_email: output.owner_email,
  permissions: filteredPermissions,
});

export const listPermissionsFilter = (output: ListPermissionsOutput, viewerEmail: string, ownerEmail: string): ListPermissionsOutput => {
  const filteredPermissions = output.permissions.map((p) =>
    filterFields(
      p as unknown as Record<string, unknown>,
      viewerEmail,
      ownerEmail
    )
  ) as unknown as PermissionEntry[];

  return listPermissionsToWire(output, filteredPermissions);
};
