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

import type { ContentRef } from './ContentRefsRepository.types/ContentRef';
import type { ContentRefsRepository } from './ContentRefsRepository.types/ContentRefsRepository';
export type { ContentRef };
export type { ContentRefsRepository };



