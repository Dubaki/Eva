-- Migration 095: Fix test_results uniqueness and clean duplicates
-- Эта миграция гарантирует, что у каждого пользователя (tg_id) может быть только один актуальный результат теста.

BEGIN;

-- 1. Найти дубликаты и оставить только последний для каждого tg_id
DELETE FROM test_results a
WHERE EXISTS (
  SELECT 1 FROM test_results b
  WHERE b.tg_id = a.tg_id
  AND b.created_at > a.created_at
);

-- 2. Добавить UNIQUE constraint
-- Сначала удаляем, если вдруг существует под другим именем, чтобы избежать конфликтов
ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_tg_id_key;
ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_tg_id_unique;

ALTER TABLE test_results ADD CONSTRAINT test_results_tg_id_unique UNIQUE (tg_id);

-- 3. Добавить индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_test_results_tg_id ON test_results(tg_id);

COMMIT;
