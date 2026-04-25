-- Migration 097: Restore profile_id to test_results
-- Мы возвращаем profile_id в таблицу test_results для обеспечения ссылочной целостности
-- и упрощения запросов (JOIN), при этом сохраняем tg_id для совместимости.

BEGIN;

-- 1. Добавляем колонку profile_id
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. Заполняем profile_id на основе tg_id из таблицы profiles
UPDATE test_results tr
SET profile_id = p.id
FROM profiles p
WHERE tr.tg_id = p.tg_id AND tr.profile_id IS NULL;

-- 3. Устанавливаем NOT NULL для profile_id (предварительно убедившись, что все заполнено)
-- Если есть записи без соответствия в profiles, они будут удалены или их нужно обработать.
-- В данном случае удаляем результаты без профиля, так как они висят "в воздухе".
DELETE FROM test_results WHERE profile_id IS NULL;
ALTER TABLE test_results ALTER COLUMN profile_id SET NOT NULL;

-- 4. Обновляем уникальные ограничения
-- Мы хотим, чтобы один профиль имел один результат теста.
-- Оставляем tg_id UNIQUE, но основным идентификатором для связей делаем profile_id.
ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_profile_id_unique;
ALTER TABLE test_results ADD CONSTRAINT test_results_profile_id_unique UNIQUE (profile_id);

-- 5. Индексы
CREATE INDEX IF NOT EXISTS idx_test_results_profile_id ON test_results(profile_id);

COMMIT;
