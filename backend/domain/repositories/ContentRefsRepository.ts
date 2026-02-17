/**
 * ContentRefsRepository - Persistence interface for ContentRef entities
 *
 * Domain-driven: works with domain entities, not raw rows.
 * Infrastructure layer provides the concrete D1 implementation.
 */

import type { DraftContentRef } from '../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../entities/ContentRef/SharedContentRef.js';
import type { ContentRefId } from '../value-objects/index.js';

export type ContentRef = DraftContentRef | SharedContentRef;

export interface ContentRefsRepository {
  /**
   * Find a content ref by its ID.
   * Returns a DraftContentRef if no shares exist, SharedContentRef otherwise.
   */
  findById(id: ContentRefId): Promise<ContentRef | null>;

  /**
   * Find a content ref by its ID, including translations.
   * Looks up sourceRefId chain for i18n fallback.
   */
  findByIdWithFallback(id: ContentRefId, lang: string): Promise<ContentRef | null>;

  /**
   * Save a new content ref.
   */
  save(contentRef: DraftContentRef): Promise<void>;

  /**
   * Find all content refs owned by a given email.
   */
  findByOwnerEmail(email: string): Promise<ContentRef[]>;
}
