ОШИБКА #5: referrer_id И referred_by — ДУБЛИРОВАНИЕ ЛОГИКИ
Суть ошибки
В profiles есть ДВА поля для реферала:

referrer_id (UUID) — кто пригласил (заполняется в /api/test/submit)
referred_by (скорее всего BIGINT или NULL) — TG ID того, по чьей ссылке пришли (заполняется в webhook)

Это создаёт два способа отслеживания одного события — источник запутанности.
Проблема: Если синхронизация между ними сломается, данные будут inconsistent.
Промт для исправления
Решение: Оставить ТОЛЬКО referred_by (как tg_id пригласившего)

// 1. Удалить referrer_id из кода, везде использовать referred_by

// В /api/test/submit вместо:
referrerId = data[0].referrer_id  // ← УДАЛИТЬ

// Использовать:
const { data: inviter } = await supabaseAdmin
  .from('profiles')
  .select('id')
  .eq('tg_id', p.referred_by)  // ← referred_by как tg_id
  .maybeSingle()

// Затем обновлять ТОЛЬКО referred_by засчётом (как флаг):
// Или добавить новую колонку referral_confirmed для отметки

// 2. Миграция: заполнить referred_by из referrer_id для старых данных
ALTER TABLE profiles ADD COLUMN referred_by BIGINT DEFAULT NULL;
UPDATE profiles p
SET referred_by = (SELECT tg_id FROM profiles WHERE id = p.referrer_id)
WHERE referrer_id IS NOT NULL;

// 3. Потом удалить referrer_id (после тестирования):
-- ALTER TABLE profiles DROP COLUMN referrer_id;

Альтернатива: Если referrer_id важна — ДОБАВИТЬ триггер синхронизации
CREATE OR REPLACE FUNCTION sync_referred_by_to_referrer()
RETURNS TRIGGER AS $$
BEGIN
  -- Когда обновляется referred_by, обновляем referrer_id на inviter.id
  IF NEW.referred_by IS NOT NULL AND NEW.referrer_id IS NULL THEN
    SELECT id INTO NEW.referrer_id
    FROM profiles
    WHERE tg_id = NEW.referred_by
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_referral
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_referred_by_to_referrer();

