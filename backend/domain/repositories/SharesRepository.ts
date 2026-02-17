/**
 * SharesRepository - Persistence interface for Share entities
 *
 * Domain-driven: works with domain entities, not raw rows.
 * Infrastructure layer provides the concrete D1 implementation.
 */

import type { ActiveShare } from '../entities/Share/ActiveShare.js';
import type { RevokedShare } from '../entities/Share/RevokedShare.js';
import type { ContentRefId, ShareId } from '../value-objects/index.js';

export interface SharesRepository {
  /**
   * Find an active share by its ID.
   */
  findById(id: ShareId): Promise<ActiveShare | null>;

  /**
   * Find all active shares for a content ref.
   */
  findByContentRefId(contentRefId: ContentRefId): Promise<ActiveShare[]>;

  /**
   * Find all active shares where the given email is the recipient.
   */
  findBySharedWith(email: string): Promise<ActiveShare[]>;

  /**
   * Find all active shares created by the given email.
   */
  findBySharedBy(email: string): Promise<ActiveShare[]>;

  /**
   * Save a new active share.
   */
  save(share: ActiveShare): Promise<void>;

  /**
   * Revoke a share: mark as revoked, persist revoked state.
   */
  revoke(share: RevokedShare): Promise<void>;
}
