-- Migration 092: Update referrals status check and sync referrals_count
-- Добавляем статус 'passed_test' и обновляем счетчики на основе прохождения теста.

-- 1. Обновляем ограничение CHECK для таблицы referrals
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('joined', 'subscribed', 'passed_test'));

-- 2. Функция для пересчета referrals_count (только тех, кто прошел тест)
CREATE OR REPLACE FUNCTION sync_referrals_count(p_profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM referrals
    WHERE owner_id = p_profile_id AND status = 'passed_test';

    UPDATE profiles
    SET referrals_count = v_count
    WHERE id = p_profile_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
