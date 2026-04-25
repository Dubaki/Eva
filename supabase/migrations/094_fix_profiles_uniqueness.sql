-- Migration 094: Fix profiles uniqueness and clean duplicates
-- Эта миграция устраняет причину появления дубликатов по tg_id

BEGIN;

-- 1. Удаляем дубликаты, оставляя только самую свежую запись для каждого tg_id
DELETE FROM profiles p1
USING profiles p2
WHERE p1.tg_id = p2.tg_id
  AND p1.created_at < p2.created_at;

-- 2. Если остались записи с одинаковым created_at (крайне маловероятно), удаляем по ID
DELETE FROM profiles p1
USING profiles p2
WHERE p1.tg_id = p2.tg_id
  AND p1.id < p2.id;

-- 3. Гарантируем наличие UNIQUE constraint
-- Сначала удаляем старый, если он был с другим именем, и создаем стандартный
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tg_id_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tg_id_unique;

ALTER TABLE profiles ADD CONSTRAINT profiles_tg_id_unique UNIQUE (tg_id);

-- 4. Убеждаемся, что tg_id не может быть NULL
ALTER TABLE profiles ALTER COLUMN tg_id SET NOT NULL;

COMMIT;
