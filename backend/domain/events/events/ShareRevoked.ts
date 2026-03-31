// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
import type { DomainEvent } from '../DomainEvent.js';
import { createEvent } from '../DomainEvent.js';

/**
 * Emitted when a share is revoked.
 */
export const shareRevoked = (shareId: string, contentRefId: string, revokedByEmail: string): DomainEvent => {
  return createEvent('share.revoked', {
    shareId,
    contentRefId,
    revokedByEmail,
  });
};
