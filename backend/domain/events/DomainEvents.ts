import type { DomainEvent } from './DomainEvent.js';

/**
 * DomainEvents port - abstraction for publishing domain events.
 * Infrastructure provides the concrete implementation.
 */
export interface DomainEvents {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
