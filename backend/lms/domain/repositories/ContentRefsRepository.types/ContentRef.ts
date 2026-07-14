import type { DraftContentRef } from '../../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../../entities/ContentRef/SharedContentRef.js';
import type { ContentRefId } from '../../value-objects/index.js';
import type { DomainEvent } from '../../events/DomainEvent.js';

export type ContentRef = DraftContentRef | SharedContentRef;
