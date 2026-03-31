// entropy-class-method-length-ok: repository — D1 queries (findById/findByCourseId/findByClassId/save) + row-to-domain reconstitution with 12 nullable columns and active share loading
/**
 * ContentRefsDatabaseRepository - D1 implementation of ContentRefsRepository
 *
 * Reconstitutes domain entities from database rows.
 * Returns DraftContentRef when no active shares exist,
 * SharedContentRef when at least one active share is present.
 */

import type { ContentRefsRepository, ContentRef } from '../../domain/repositories/ContentRefsRepository.js';
import type { DomainEvents } from '../../domain/events/DomainEvents.js';
import type { DomainEvent } from '../../domain/events/DomainEvent.js';
import { DraftContentRef } from '../../domain/entities/ContentRef/DraftContentRef.js';
import { SharedContentRef } from '../../domain/entities/ContentRef/SharedContentRef.js';
import { ActiveShare } from '../../domain/entities/Share/ActiveShare.js';
import { ContentRefId, ConnectionId, Email, ShareId } from '../../domain/value-objects/index.js';
import type { ContentType, ContentUsage, ContentRefProps } from '../../domain/entities/ContentRef/types.js';
import type { ShareRole } from '../../domain/entities/ContentRef/SharedContentRef.js';

/** Raw row shape from the lms_content_ref table */
interface ContentRefRow {
  id: string;
  connection_id: string;
  file_id: string;
  name: string;
  content_type: string;
  owner_email: string;
  course_id: string | null;
  class_id: string | null;
  usage: string | null;
  lang: string;
  source_ref_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw row shape from the lms_content_share table (for joins) */
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

export class ContentRefsDatabaseRepository implements ContentRefsRepository {
  constructor(
    private readonly db: D1Database,
    private readonly events: DomainEvents,
  ) {}

  async findById(id: ContentRefId): Promise<ContentRef | null> {
    const row = await this.db
      .prepare('SELECT * FROM lms_content_ref WHERE id = ?')
      .bind(id.value)
      .first<ContentRefRow>();

    if (!row) return null;

    return this.reconstitute(row);
  }

  async findByCourseId(courseId: string): Promise<ContentRef[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM lms_content_ref WHERE course_id = ?')
      .bind(courseId)
      .all<ContentRefRow>();

    return Promise.all(results.map((row) => this.reconstitute(row)));
  }

  async findByClassId(classId: string): Promise<ContentRef[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM lms_content_ref WHERE class_id = ?')
      .bind(classId)
      .all<ContentRefRow>();

    return Promise.all(results.map((row) => this.reconstitute(row)));
  }

  async save(contentRef: DraftContentRef | SharedContentRef): Promise<void> {
    const props = contentRef.toProps();

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO lms_content_ref
           (id, connection_id, file_id, name, content_type, owner_email,
            course_id, class_id, usage, lang, source_ref_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        props.id.value,
        props.connectionId.value,
        props.fileId,
        props.name,
        props.contentType,
        props.ownerEmail.value,
        props.courseId,
        props.classId,
        props.usage,
        props.lang,
        props.sourceRefId?.value ?? null,
        props.createdAt.toISOString(),
        props.updatedAt.toISOString(),
      )
      .run();
  }

  async publish(event: DomainEvent, contentRef: DraftContentRef | SharedContentRef): Promise<void> {
    await this.save(contentRef);
    await this.events.publish(event);
  }

  // === Private helpers ===

  /**
   * Reconstitute a domain entity from a DB row.
   * Checks for active shares to determine Draft vs Shared.
   */
  private async reconstitute(row: ContentRefRow): Promise<ContentRef> {
    const props = this.rowToProps(row);
    const activeShares = await this.loadActiveShares(row.id);

    if (activeShares.length > 0) {
      return SharedContentRef.reconstitute(props, activeShares);
    }

    return DraftContentRef.reconstitute(props);
  }

  /**
   * Load active (non-revoked) shares for a content ref.
   */
  private async loadActiveShares(contentRefId: string): Promise<ActiveShare[]> {
    const { results } = await this.db
      .prepare(
        'SELECT * FROM lms_content_share WHERE content_ref_id = ? AND revoked_at IS NULL',
      )
      .bind(contentRefId)
      .all<ShareRow>();

    return results.map(({ id, content_ref_id, shared_by, shared_with, shared_at }) =>
      ActiveShare.reconstitute({
        id: ShareId.reconstitute(id),
        contentRefId: ContentRefId.reconstitute(content_ref_id),
        sharedByEmail: Email.reconstitute(shared_by),
        sharedWithEmail: Email.reconstitute(shared_with),
        role: shareRow.role.toLowerCase() as ShareRole,
        createdAt: new Date(shared_at),
        updatedAt: new Date(shared_at),
      }),
    );
  }

  /**
   * Map a raw DB row to ContentRefProps (value objects).
   */
  private rowToProps(row: ContentRefRow): ContentRefProps {
    return {
      id: ContentRefId.reconstitute(row.id),
      connectionId: ConnectionId.reconstitute(row.connection_id),
      fileId: row.file_id,
      name: row.name,
      contentType: row.content_type as ContentType,
      ownerEmail: Email.reconstitute(row.owner_email),
      courseId: row.course_id,
      classId: row.class_id,
      usage: row.usage as ContentUsage | null,
      lang: row.lang,
      sourceRefId: row.source_ref_id ? ContentRefId.reconstitute(row.source_ref_id) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
