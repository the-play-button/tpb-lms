import type { DomainEvent } from '../DomainEvent.js';
import { createEvent } from '../DomainEvent.js';

/**
 * Emitted when a share is revoked.
 */
export function shareRevoked(
  shareId: string,
  contentRefId: string,
  revokedByEmail: string,
): DomainEvent {
  return createEvent('share.revoked', {
    shareId,
    contentRefId,
    revokedByEmail,
  });
}
