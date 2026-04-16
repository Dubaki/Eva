-- Migration 090: Repair DB structure
-- Adding columns that were missed in previous steps but are required for logic.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ DEFAULT NULL;

-- Ensure PostgREST cache is reloaded (this works if executed via SQL console)
NOTIFY pgrst, 'reload schema';
