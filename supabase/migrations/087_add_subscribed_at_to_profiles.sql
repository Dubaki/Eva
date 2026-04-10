-- Migration: Add subscribed_at column to profiles
-- Purpose: Track when a user first subscribed (CRM Journey Step 2)
-- Date: 2026-04-10 (Task 087)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscribed_at timestamptz;

COMMENT ON COLUMN profiles.subscribed_at IS 'Timestamp when user first confirmed subscription';
