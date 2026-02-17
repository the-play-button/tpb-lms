/**
 * Domain Event - Base interface for all domain events
 *
 * Domain events represent something meaningful that happened in the domain.
 * They are immutable records of business-relevant occurrences.
 */
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export function createEvent(type: string, payload: Record<string, unknown>): DomainEvent {
  return { type, occurredAt: new Date(), payload };
}
