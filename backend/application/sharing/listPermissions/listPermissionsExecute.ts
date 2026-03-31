// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import { filterFields } from '../../filters/FieldSecurityFilter.js';
import type { ListPermissionsAssertedInput } from './listPermissionsAssert.js';

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

type ListPermissionsError = 'NOT_FOUND' | 'FORBIDDEN' | string;

/**
 * Execute step: fetch contentRef, fetch active shares, apply FLS, return.
 */
export const listPermissionsExecute = async (input: ListPermissionsAssertedInput, ctx: HandlerContext): Promise<Result<ListPermissionsError, ListPermissionsOutput>> => {
  const refId = ContentRefId.reconstitute(input.ref_id);
  const contentRef = await ctx.contentRefsRepository.findById(refId);
  if (!contentRef) {
    return fail('NOT_FOUND' as const);
  }

  const isOwner = contentRef.ownerEmail.value === ctx.userEmail;
  if (!isOwner) {
    return fail('FORBIDDEN' as const);
  }

  const shares = await ctx.sharesRepository.findActiveByContentRef(contentRef.id);
  const permissions: PermissionEntry[] = shares.map((s) => ({
    id: s.id.value,
    shared_with: s.sharedWithEmail.value,
    role: s.role === 'editor' ? 'WRITE' : 'READ',
    created_at: s.createdAt.toISOString(),
  }));

  const filteredPermissions = permissions.map((p) =>
    filterFields(
      p as unknown as Record<string, unknown>,
      ctx.userEmail,
      contentRef.ownerEmail.value
    )
  ) as unknown as PermissionEntry[];

  return succeed({
    content_ref_id: contentRef.id.value,
    owner_email: contentRef.ownerEmail.value,
    permissions: filteredPermissions,
  });
};
