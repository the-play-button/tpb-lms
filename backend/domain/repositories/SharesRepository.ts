// entropy-multiple-exports-ok: SharesRepository module has 2 tightly-coupled exports sharing internal state
/**
 * SharesRepository - Persistence port for Share aggregates.
 *
 * Domain-driven: works with domain entities, not raw rows.
 * Infrastructure layer provides the concrete D1 implementation.
 */

import type { ActiveShare } from '../entities/Share/ActiveShare.js';
import type { RevokedShare } from '../entities/Share/RevokedShare.js';
import type { ShareId, ContentRefId, Email } from '../value-objects/index.js';
import type { DomainEvent } from '../events/DomainEvent.js';

export type Share = ActiveShare | RevokedShare;

export interface SharesRepository {
  /** Find a share by ID (active or revoked). */
  findById(id: ShareId): Promise<Share | null>;

  /** Find all active (non-revoked) shares for a content ref. */
  findActiveByContentRef(contentRefId: ContentRefId): Promise<ActiveShare[]>;

  /** Find all shares where the given email is the recipient. */
  findBySharedWith(email: Email): Promise<Share[]>;

  /** Find all shares created by the given email. */
  findBySharedBy(email: Email): Promise<Share[]>;

  /** Save (insert or update) a share. */
  save(share: ActiveShare | RevokedShare): Promise<void>;

  /** Save and publish: persist the share then emit a domain event. */
  publish(event: DomainEvent, share: ActiveShare | RevokedShare): Promise<void>;
}
