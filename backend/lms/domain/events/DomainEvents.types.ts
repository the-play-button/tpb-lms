import type { DomainEvent } from './DomainEvent.js';

export interface DomainEvents {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
