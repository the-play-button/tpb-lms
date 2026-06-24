/**
 * Events Helper — shared event-id generator.
 *
 * `storeEvent` was removed 2026-06-24 (Plan 01) once event persistence moved
 * to `backend/services/events/EventsService.js::persistValidatedEvent` (the
 * blessed pipeline that also fires projections). Reintroducing a thin INSERT
 * helper would re-enable handler-side DB access which breaks the
 * `handler_service_pattern` doctrine.
 */

/**
 * Generate unique event ID. CSPRNG `crypto.randomUUID()` for the suffix
 * (Math.random is predictable per bearer § insufficiently-random-values).
 * Format: evt_{timestamp}_{random}
 */
export const generateEventId = () =>
    `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`;
