import type { DomainEvent } from '../DomainEvent.js';
import { createEvent } from '../DomainEvent.js';

/**
 * Emitted when a content ref is shared with another user.
 */
export function contentShared(
  contentRefId: string,
  shareId: string,
  sharedByEmail: string,
  sharedWithEmail: string,
  role: string,
): DomainEvent {
  return createEvent('content.shared', {
    contentRefId,
    shareId,
    sharedByEmail,
    sharedWithEmail,
    role,
  });
}
