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

import type { Share } from './SharesRepository.types/Share';
import type { SharesRepository } from './SharesRepository.types/SharesRepository';
export type { Share };
export type { SharesRepository };



