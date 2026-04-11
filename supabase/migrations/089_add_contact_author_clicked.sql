-- Migration 089: Add contact_author_clicked column to profiles
-- Tracks users who requested contact with the author ("Связь с Автором")

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_author_clicked BOOLEAN DEFAULT FALSE;
