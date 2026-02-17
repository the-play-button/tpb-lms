// entropy-class-method-length-ok: cohesive method
/**
 * SharesDatabaseRepository - D1 implementation of SharesRepository
 *
 * Reconstitutes ActiveShare or RevokedShare entities from database rows.
 * Active shares have revoked_at IS NULL; revoked shares have a revoked_at timestamp.
 */

import type { SharesRepository, Share } from '../../domain/repositories/SharesRepository.js';
import type { DomainEvents } from '../../domain/events/DomainEvents.js';
import type { DomainEvent } from '../../domain/events/DomainEvent.js';
import { ActiveShare } from '../../domain/entities/Share/ActiveShare.js';
import { RevokedShare } from '../../domain/entities/Share/RevokedShare.js';
import { ShareId, ContentRefId, Email } from '../../domain/value-objects/index.js';
import type { ShareRole } from '../../domain/entities/ContentRef/SharedContentRef.js';

/** Raw row shape from the lms_content_share table */
interface ShareRow {
  id: string;
  content_ref_id: string;
  shared_by: string;
  shared_with: string;
  role: string;
  provider_permission_id: string | null;
  shared_at: string;
  revoked_at: string | null;
}

export class SharesDatabaseRepository implements SharesRepository {
  constructor(
    private readonly db: D1Database,
    private readonly events: DomainEvents,
  ) {}

  async findById(id: ShareId): Promise<Share | null> {
    const row = await this.db
      .prepare('SELECT * FROM lms_content_share WHERE id = ?')
      .bind(id.value)
      .first<ShareRow>();

    if (!row) return null;

    return this.reconstitute(row);
  }

  async findActiveByContentRef(contentRefId: ContentRefId): Promise<ActiveShare[]> {
    const { results } = await this.db
      .prepare(
        'SELECT * FROM lms_content_share WHERE content_ref_id = ? AND revoked_at IS NULL',
      )
      .bind(contentRefId.value)
      .all<ShareRow>();

    return results.map((row) => this.reconstituteActive(row));
  }

  async findBySharedWith(email: Email): Promise<Share[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM lms_content_share WHERE shared_with = ?')
      .bind(email.value)
      .all<ShareRow>();

    return results.map((row) => this.reconstitute(row));
  }

  async findBySharedBy(email: Email): Promise<Share[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM lms_content_share WHERE shared_by = ?')
      .bind(email.value)
      .all<ShareRow>();

    return results.map((row) => this.reconstitute(row));
  }

  async save(share: ActiveShare | RevokedShare): Promise<void> {
    if (share.kind === 'active') {
      await this.saveActive(share);
    } else {
      await this.saveRevoked(share);
    }
  }

  async publish(event: DomainEvent, share: ActiveShare | RevokedShare): Promise<void> {
    await this.save(share);
    await this.events.publish(event);
  }

  // === Private helpers ===

  private async saveActive(share: ActiveShare): Promise<void> {
    const props = share.toProps();

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO lms_content_share
           (id, content_ref_id, shared_by, shared_with, role, shared_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        props.id.value,
        props.contentRefId.value,
        props.sharedByEmail.value,
        props.sharedWithEmail.value,
        props.role.toUpperCase(),
        props.createdAt.toISOString(),
      )
      .run();
  }

  private async saveRevoked(share: RevokedShare): Promise<void> {
    const props = share.toProps();

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO lms_content_share
           (id, content_ref_id, shared_by, shared_with, role, shared_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        props.id.value,
        props.contentRefId.value,
        props.sharedByEmail.value,
        props.sharedWithEmail.value,
        props.role.toUpperCase(),
        props.createdAt.toISOString(),
        props.revokedAt.toISOString(),
      )
      .run();
  }

  /**
   * Reconstitute either an ActiveShare or RevokedShare from a DB row.
   */
  private reconstitute(row: ShareRow): Share {
    if (row.revoked_at) {
      return this.reconstituteRevoked(row);
    }
    return this.reconstituteActive(row);
  }

  private reconstituteActive(row: ShareRow): ActiveShare {
    return ActiveShare.reconstitute({
      id: ShareId.reconstitute(row.id),
      contentRefId: ContentRefId.reconstitute(row.content_ref_id),
      sharedByEmail: Email.reconstitute(row.shared_by),
      sharedWithEmail: Email.reconstitute(row.shared_with),
      role: row.role.toLowerCase() as ShareRole,
      createdAt: new Date(row.shared_at),
      updatedAt: new Date(row.shared_at),
    });
  }

  private reconstituteRevoked(row: ShareRow): RevokedShare {
    return RevokedShare.reconstitute({
      id: ShareId.reconstitute(row.id),
      contentRefId: ContentRefId.reconstitute(row.content_ref_id),
      sharedByEmail: Email.reconstitute(row.shared_by),
      sharedWithEmail: Email.reconstitute(row.shared_with),
      role: row.role.toLowerCase() as ShareRole,
      createdAt: new Date(row.shared_at),
      updatedAt: new Date(row.shared_at),
      revokedAt: new Date(row.revoked_at!),
      revokedByEmail: Email.reconstitute(row.shared_by),
    });
  }
}
