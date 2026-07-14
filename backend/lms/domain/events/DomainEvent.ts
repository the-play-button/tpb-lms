
import type { DomainEvent } from './DomainEvent.types';
export type { DomainEvent };

/**
 * Domain Event - Base interface for all domain events
 *
 * Domain events represent something meaningful that happened in the domain.
 * They are immutable records of business-relevant occurrences.
 */

export const createEvent = (type: string, payload: Record<string, unknown>): DomainEvent => {
  return { type, occurredAt: new Date(), payload };
};
