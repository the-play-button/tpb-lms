import { log } from '@the-play-button/tpb-sdk-js';
import type { DomainEvents } from '../../domain/events/DomainEvents.js';
import type { DomainEvent } from '../../domain/events/DomainEvent.js';

/**
 * Simple publisher that just logs events.
 * For the LMS MVP, events are logged for audit but not dispatched to external systems.
 */
export class JustForwardDomainEventPublisher implements DomainEvents {
  async publish(event: DomainEvent): Promise<void> {
    // The audit trail this class promises: every domain event reaches telemetry (no external dispatch yet).
    log.info('lms.domain_event', { type: event.type, occurredAt: event.occurredAt.toISOString(), payload: event.payload });
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
