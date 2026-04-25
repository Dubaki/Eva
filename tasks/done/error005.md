ОШИБКА #6: НЕЛЬЗЯ ОТСЛЕДИТЬ "УСПЕШНЫЙ РЕФЕРАЛ" (отсутствует флаг)
Суть ошибки
В таблице есть:

referred_by — кто пригласил (заполняется при регистрации)
referrer_id — ID пригласившего (заполняется после прохождения теста)

Но нет способа узнать, был ли реферал успешным!
Сценарий:User B открывает: /start ref_<A_tgId>
├─ referred_by = A_tgId ✓
│
User B НЕ проходит тест (закрыл приложение)
├─ referrer_id остаётся NULL ✗
│
Теперь: Как узнать, был ли это успешный реферал или нет?

Промт для исправления
Добавить флаг referral_confirmed:
-- supabase/migrations/103_add_referral_confirmed.sql

ALTER TABLE profiles ADD COLUMN referral_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN referral_confirmed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_profiles_referral_confirmed ON profiles(referral_confirmed);

В коде /api/test/submit при засчёте реферала:
// После успешного обновления invites_count и referrer_id:

await supabaseAdmin
  .from('profiles')
  .update({ 
    referrer_id: inviter.id,
    referral_confirmed: true,           // ← НОВОЕ
    referral_confirmed_at: new Date().toISOString()  // ← НОВОЕ
  })
  .eq('id', p.id)

Теперь можно анализировать:-- Все пригласившие (даже если не подтвердили)
SELECT COUNT(*) FROM profiles WHERE referred_by IS NOT NULL;

-- Подтвержденные рефералы (прошли тест)
SELECT COUNT(*) FROM profiles WHERE referral_confirmed = true;

-- % конверсии
SELECT 
  SUM(CASE WHEN referral_confirmed THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
FROM profiles WHERE referred_by IS NOT NULL;
