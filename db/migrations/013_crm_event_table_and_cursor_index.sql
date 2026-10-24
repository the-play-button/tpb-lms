-- crm_event lived in the deployed D1 from the pre-migrations schema but was never created by a migration
-- (a fresh apply had no such table while SessionService / LearnerProgressService query it). This migration
-- versions the deployed definition (IF NOT EXISTS: no-op on existing databases) and adds the covering indexes
-- for the keyset reads `WHERE user_id = ? [AND type = ?] ORDER BY created_at DESC LIMIT n`.

CREATE TABLE IF NOT EXISTS crm_event (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    contact_ids_json TEXT,
    company_ids_json TEXT,
    deal_ids_json TEXT,
    lead_ids_json TEXT,
    user_id TEXT,
    page_view_json TEXT,
    form_json TEXT,
    call_json TEXT,
    email_json TEXT,
    meeting_json TEXT,
    note_json TEXT,
    task_json TEXT,
    marketing_email_json TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_event_user_created ON crm_event(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_event_user_type_created ON crm_event(user_id, type, created_at DESC);
