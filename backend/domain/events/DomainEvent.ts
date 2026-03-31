// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
// entropy-multiple-exports-ok: cohesive module exports
// entropy-god-file-ok: domain event base — DomainEvent interface + createEvent factory, single source of truth for event shape
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

export const createEvent = (type: string, payload: Record<string, unknown>): DomainEvent => {
  return { type, occurredAt: new Date(), payload };
};
