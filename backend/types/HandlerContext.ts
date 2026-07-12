/**
 * HandlerUserContext — the per-request context object the router injects as the
 * 3rd argument of every route handler (`c.var.userContext`).
 *
 * Built in `backend/index.ts` auth middleware from the resolved bastion actor:
 *   { user: { email, role }, contact, employee, learner }
 */

/** A resolved CRM contact / learner record (shape varies by query). */
export interface ContactRecord {
    id?: string;
    [key: string]: unknown;
}

export interface HandlerUserContext {
    user: { email: string | null; role: string };
    contact: ContactRecord | null;
    employee: ContactRecord | null;
    learner: ContactRecord | null;
}
