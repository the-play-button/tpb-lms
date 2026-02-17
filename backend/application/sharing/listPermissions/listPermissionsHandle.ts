// entropy-multiple-exports-ok: cohesive module exports
import type { Result } from '../../../domain/core/Result.js';
import { fail, succeed } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import { filterFields } from '../../filters/FieldSecurityFilter.js';

export interface PermissionEntry {
  shareId: string;
  sharedWithEmail: string;
  role: string;
  createdAt: string;
}

export interface ListPermissionsOutput {
  contentRefId: string;
  ownerEmail: string;
  permissions: PermissionEntry[];
}

type ListPermissionsError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Handle: fetch contentRef, fetch active shares, filter by FLS, return.
 *
 * Simple use case - inline pipeline without separate step files.
 */
export async function listPermissionsHandle(
  request: Request,
  ctx: HandlerContext
): Promise<Result<ListPermissionsError, ListPermissionsOutput>> {
  // 1. ValidateInput
  const url = new URL(request.url);
  const refIdRaw = url.searchParams.get('ref_id');
  if (!refIdRaw) {
    return fail('ref_id is required');
  }

  // 2. HydrateContext
  const refId = ContentRefId.reconstitute(refIdRaw);
  const contentRef = await ctx.contentRefsRepository.findById(refId);
  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  // 3. CheckPolicies - only owner can list permissions
  const isOwner = contentRef.ownerEmail.value === ctx.userEmail;
  if (!isOwner) {
    return fail('FORBIDDEN' as const);
  }

  // 4. Execute
  const shares = await ctx.sharesRepository.findActiveByContentRef(contentRef.id);
  const permissions: PermissionEntry[] = shares.map((s) => ({
    shareId: s.id.value,
    sharedWithEmail: s.sharedWithEmail.value,
    role: s.role,
    createdAt: s.createdAt.toISOString(),
  }));

  // 5. Filter - FLS on each permission entry
  // Owner is viewing their own data, so no fields are stripped here,
  // but we keep the pattern for consistency.
  const filteredPermissions = permissions.map((p) =>
    filterFields(
      p as unknown as Record<string, unknown>,
      ctx.userEmail,
      contentRef.ownerEmail.value
    )
  ) as unknown as PermissionEntry[];

  return succeed({
    contentRefId: contentRef.id.value,
    ownerEmail: contentRef.ownerEmail.value,
    permissions: filteredPermissions,
  });
}
