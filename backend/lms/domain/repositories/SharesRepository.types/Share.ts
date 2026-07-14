import type { ActiveShare } from '../../entities/Share/ActiveShare.js';
import type { RevokedShare } from '../../entities/Share/RevokedShare.js';
import type { ShareId, ContentRefId, Email } from '../../value-objects/index.js';
import type { DomainEvent } from '../../events/DomainEvent.js';

export type Share = ActiveShare | RevokedShare;
