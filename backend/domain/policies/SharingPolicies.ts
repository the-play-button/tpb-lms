// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../core/Result.js';
import type { Email } from '../value-objects/index.js';
import type { DraftContentRef } from '../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../entities/ContentRef/SharedContentRef.js';
import type { ActiveShare } from '../entities/Share/ActiveShare.js';

const DEFAULT_MAX_SHARES = 50;

/**
 * Only the owner of a content ref is allowed to share it.
 */
export function onlyOwnerCanSharePolicy(
  contentRef: DraftContentRef | SharedContentRef,
  userEmail: Email,
): Result<string, 'allowed'> {
  if (!contentRef.ownerEmail.equals(userEmail)) {
    return fail('Only the owner can share this content');
  }
  return succeed('allowed' as const);
}

/**
 * Limits the number of active shares on a single content ref.
 */
export function maxSharesPolicy(
  existingShares: ActiveShare[],
  max: number = DEFAULT_MAX_SHARES,
): Result<string, 'allowed'> {
  if (existingShares.length >= max) {
    return fail(`Maximum number of shares (${max}) reached`);
  }
  return succeed('allowed' as const);
}
