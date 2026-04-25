 ОШИБКА #2: referred_by В PROFILES — ТИП НЕПРАВИЛЬНЫЙ (должен быть UUID)
Суть ошибки
В скриншоте видно, что referred_by в таблице profiles = NULL (текстовое значение NULL или JSONB?).
По коду в /api/test/submit (строка 45):referredBy = data[0].referred_by

И потом:const { data: inviter } = await supabaseAdmin
  .from('profiles')
  .select('id, tg_id, invites_count')
  .eq('tg_id', p.referred_by)  // ← referred_by используется как tg_id!

Проблема: Если referred_by имеет тип UUID (как должно быть правильно), но код ищет по tg_id (BIGINT), это несоответствие.
Промт для исправления
Вариант 1: Если referred_by должна быть tg_id (BIGINT) — НУЖНО ИСПРАВИТЬ КОД
// Файл: app/api/test/submit/route.ts
// Строки: 79-115 (блок Referral Reward Logic)

// Текущий (неправильный) код:
if (p && p.referred_by && !p.referrer_id) {
  const { data: inviter } = await supabaseAdmin
    .from('profiles')
    .select('id, tg_id, invites_count')
    .eq('tg_id', p.referred_by)  // ✓ Это правильно, если referred_by = BIGINT tg_id

// Но! Проверить, что referred_by действительно BIGINT:
const inviterData = await supabaseAdmin
  .from('profiles')
  .select('id, tg_id, invites_count, referred_by')
  .eq('tg_id', Number(p.referred_by))  // ← Явно конвертируем в Number
  .maybeSingle()

Вариант 2: Если нужно хранить UUID пригласившего — ДОБАВИТЬ ПОЛЕ

-- supabase/migrations/101_add_referrer_uuid.sql

-- Если referred_by это UUID, переименовать на inviter_id:
ALTER TABLE profiles RENAME COLUMN referred_by TO inviter_id;

-- Или добавить новое поле и миграцировать данные:
ALTER TABLE profiles ADD COLUMN inviter_uuid UUID DEFAULT NULL;
UPDATE profiles SET inviter_uuid = referrer_id WHERE referrer_id IS NOT NULL;

