import type { DomainEvent } from '../DomainEvent.js';
import { createEvent } from '../DomainEvent.js';

/**
 * Emitted when a content ref is accessed by a user.
 */
export const contentAccessed = (contentRefId: string, accessedByEmail: string): DomainEvent => {
  return createEvent('content.accessed', {
    contentRefId,
    accessedByEmail,
    accessedAt: new Date().toISOString(),
  });
};
