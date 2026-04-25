-- Migration 096: Fix referred_by type and ensure it is BIGINT
-- Мы гарантируем, что referred_by имеет тип BIGINT (для хранения tg_id пригласившего)
-- и убираем возможные строковые значения "NULL", которые могли попасть туда по ошибке.

BEGIN;

-- 1. Если колонка существует, попробуем конвертировать её в BIGINT
-- Сначала очистим строковые "NULL" или пустые строки
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referred_by') THEN
        -- Обнуляем все значения, которые не являются числами
        UPDATE profiles 
        SET referred_by = NULL 
        WHERE referred_by::text ~ '[^0-9]' OR referred_by::text = '';
        
        -- Меняем тип на BIGINT
        ALTER TABLE profiles 
        ALTER COLUMN referred_by TYPE BIGINT USING referred_by::bigint;
    ELSE
        -- Если колонки нет, добавляем её
        ALTER TABLE profiles ADD COLUMN referred_by BIGINT DEFAULT NULL;
    END IF;
END $$;

-- 2. Индекс для ускорения поиска по referred_by
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

COMMIT;
