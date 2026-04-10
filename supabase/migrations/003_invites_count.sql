-- EVA Database Migration 003
-- invites_count — счётчик приглашений по подписке (не требует прохождения теста)
-- Дата: 2026-04-09

-- invites_count — инкрементируется когда реферал подтверждает подписку на канал
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invites_count INTEGER NOT NULL DEFAULT 0;
