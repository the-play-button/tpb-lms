/**
 * ContentRefsRepository - Persistence port for ContentRef aggregates.
 *
 * Domain-driven: works with domain entities, not raw rows.
 * Returns DraftContentRef when no active shares exist,
 * SharedContentRef when at least one active share is present.
 */


import type { ContentRef } from './ContentRefsRepository.types/ContentRef';
import type { ContentRefsRepository } from './ContentRefsRepository.types/ContentRefsRepository';
export type { ContentRef };
export type { ContentRefsRepository };



