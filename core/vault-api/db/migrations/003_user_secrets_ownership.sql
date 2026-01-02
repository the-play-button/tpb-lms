-- ============================================
-- TPB VAULT MIGRATION 003 - User Secrets Ownership
-- Adds ownership for user_settings connections
-- ============================================

-- Add owner_user_id to link user_settings connections to their owner
ALTER TABLE connection ADD COLUMN owner_user_id TEXT REFERENCES iam_user(id);

-- Index for fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_connection_owner ON connection(owner_user_id);

-- Update existing user_settings connection with owner
-- Extract email from connection ID and link to iam_user
UPDATE connection 
SET owner_user_id = (
    SELECT u.id 
    FROM iam_user u 
    WHERE u.email = 'matthieu.marielouise@theplaybutton.ai'
)
WHERE integration_type = 'user_settings' 
  AND id = 'conn_user_matthieu_marielouise_at_theplaybutton_ai';
