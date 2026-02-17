// entropy-class-method-length-ok: event publisher — publish + publishAll, minimal DomainEvents implementation (log-only, no storage)
// entropy-console-leak-ok: intentional logging
import type { DomainEvents } from '../../domain/events/DomainEvents.js';
import type { DomainEvent } from '../../domain/events/DomainEvent.js';

/**
 * Simple publisher that just logs events.
 * For the LMS MVP, events are logged for audit but not dispatched to external systems.
 */
export class JustForwardDomainEventPublisher implements DomainEvents {
  async publish(event: DomainEvent): Promise<void> {
    console.log(`[domain-event] ${event.type}`, JSON.stringify(event.payload));
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
