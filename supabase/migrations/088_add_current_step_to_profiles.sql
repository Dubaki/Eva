-- Migration 088: Add current_step column to profiles for test state persistence
-- Allows resuming a test from the last visited question

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT NULL;
