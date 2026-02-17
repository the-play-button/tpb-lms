// entropy-class-method-length-ok: cohesive method
// entropy-console-leak-ok: intentional logging
import type { DomainEvents } from '../../domain/events/DomainEvents.js';
import type { DomainEvent } from '../../domain/events/DomainEvent.js';

/**
 * Stores events in D1 then logs them.
 *
 * Uses the lms_content_access table for access events.
 * Other event types are logged to console for now, with D1 storage
 * reserved for the audit trail that matters (who accessed what).
 */
export class StoreAndForwardDomainEventPublisher implements DomainEvents {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async publish(event: DomainEvent): Promise<void> {
    // Store access events in D1 for audit trail
    if (event.type === 'content.accessed') {
      await this.storeAccessEvent(event);
    }

    // Always log
    console.log(`[domain-event] ${event.type}`, JSON.stringify(event.payload));
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Store a content access event in the lms_content_access table.
   */
  private async storeAccessEvent(event: DomainEvent): Promise<void> {
    const { contentRefId, accessedByEmail, accessedAt } = event.payload as {
      contentRefId: string;
      accessedByEmail: string;
      accessedAt: string;
    };

    await this.db
      .prepare(
        `INSERT INTO lms_content_access (id, content_ref_id, user_email, accessed_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), contentRefId, accessedByEmail, accessedAt)
      .run();
  }
}
