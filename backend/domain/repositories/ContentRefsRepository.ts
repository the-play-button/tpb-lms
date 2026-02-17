// entropy-multiple-exports-ok: cohesive module exports
// entropy-god-file-ok: repository port — ContentRef union type + ContentRefsRepository interface with find/save/publish for Draft and Shared aggregates
/**
 * ContentRefsRepository - Persistence port for ContentRef aggregates.
 *
 * Domain-driven: works with domain entities, not raw rows.
 * Returns DraftContentRef when no active shares exist,
 * SharedContentRef when at least one active share is present.
 */

import type { DraftContentRef } from '../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../entities/ContentRef/SharedContentRef.js';
import type { ContentRefId } from '../value-objects/index.js';
import type { DomainEvent } from '../events/DomainEvent.js';

export type ContentRef = DraftContentRef | SharedContentRef;

export interface ContentRefsRepository {
  /**
   * Find a content ref by its ID.
   * Returns DraftContentRef if no active shares, SharedContentRef otherwise.
   */
  findById(id: ContentRefId): Promise<ContentRef | null>;

  /**
   * Find all content refs for a given course.
   */
  findByCourseId(courseId: string): Promise<ContentRef[]>;

  /**
   * Find all content refs for a given class.
   */
  findByClassId(classId: string): Promise<ContentRef[]>;

  /**
   * Save (insert or update) a content ref.
   */
  save(contentRef: DraftContentRef | SharedContentRef): Promise<void>;

  /**
   * Save and publish: persist the content ref then emit a domain event.
   */
  publish(event: DomainEvent, contentRef: DraftContentRef | SharedContentRef): Promise<void>;
}
