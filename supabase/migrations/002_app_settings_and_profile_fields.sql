-- EVA Database Migration 002
-- app_settings table, new profile fields (selected_sphere, dominant_trait, shadow_trait, referrals_count, reminded_at)
-- Дата: 2026-04-09

-- ============================================================
-- 1. app_settings — ключ-значение для настроек (ссылки на подарки)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Триггер авто-обновления updated_at
CREATE TRIGGER trg_app_settings_updated
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS: SELECT для всех (публичные настройки), UPDATE только через service_role
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_public" ON app_settings
    FOR SELECT USING (true);

-- ============================================================
-- 2. Дефолтные ссылки на подарки (плейсхолдеры)
-- ============================================================
INSERT INTO app_settings (key, value) VALUES
    ('gift_money', 'https://t.me/example_money'),
    ('gift_relations', 'https://t.me/example_relations'),
    ('gift_health', 'https://t.me/example_health'),
    ('gift_other', 'https://t.me/example_other')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. Новые поля в profiles
-- ============================================================

-- selected_sphere — сфера подарка (Деньги/Отношения/Здоровье/Другое)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_sphere VARCHAR NULL;

-- dominant_trait — доминирующая опора (дубликат из test_results для удобства)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dominant_trait VARCHAR(1) NULL
    CONSTRAINT chk_profiles_dominant_trait CHECK (dominant_trait IN ('S','U','P','R','K'));

-- shadow_trait — теневая (вторичная) опора
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shadow_trait VARCHAR(1) NULL
    CONSTRAINT chk_profiles_shadow_trait CHECK (shadow_trait IN ('S','U','P','R','K'));

-- referrals_count — счётчик рефералов (кэшированное значение)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referrals_count INTEGER NOT NULL DEFAULT 0;

-- reminded_at — метка времени последнего напоминания (для Cron-задачи 60 дней)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ NULL;
