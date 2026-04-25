-- Migration 098: Unify referral logic and add confirmation flag
-- Мы синхронизируем referred_by (TG ID) и referrer_id (UUID) через триггер
-- и вводим флаг referral_confirmed для отслеживания успешных приглашений.

BEGIN;

-- 1. Добавляем колонку referral_confirmed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_confirmed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Индекс для аналитики
CREATE INDEX IF NOT EXISTS idx_profiles_referral_confirmed ON profiles(referral_confirmed);

-- 3. Функция триггера для синхронизации referred_by -> referrer_id
CREATE OR REPLACE FUNCTION sync_referred_by_to_referrer()
RETURNS TRIGGER AS $$
BEGIN
  -- Если referred_by (TG ID) установлен, а referrer_id (UUID) еще нет,
  -- пытаемся найти соответствующий UUID в таблице profiles.
  IF NEW.referred_by IS NOT NULL AND (NEW.referrer_id IS NULL OR OLD.referred_by IS DISTINCT FROM NEW.referred_by) THEN
    SELECT id INTO NEW.referrer_id
    FROM profiles
    WHERE tg_id = NEW.referred_by
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Создаем триггер
DROP TRIGGER IF EXISTS trg_sync_referral ON profiles;
CREATE TRIGGER trg_sync_referral
BEFORE INSERT OR UPDATE OF referred_by ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_referred_by_to_referrer();

-- 5. Обратная миграция данных: проставляем флаг тем, у кого уже есть referrer_id
-- (так как в старой логике наличие referrer_id означало подтвержденный реферал)
UPDATE profiles 
SET referral_confirmed = TRUE, referral_confirmed_at = created_at
WHERE referrer_id IS NOT NULL AND referral_confirmed = FALSE;

-- 6. Синхронизируем пропущенные referrer_id для тех, у кого есть referred_by
UPDATE profiles p
SET referrer_id = (SELECT id FROM profiles WHERE tg_id = p.referred_by)
WHERE referred_by IS NOT NULL AND referrer_id IS NULL;

COMMIT;
