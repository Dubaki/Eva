-- EVA Database Migration 001
-- Initial schema: profiles, qualifications, test_results, referrals, referral_log
-- Дата: 2026-04-08

-- ============================================================
-- 1. profiles — пользовательские профили
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tg_id                   BIGINT UNIQUE NOT NULL,
    username                VARCHAR NULL,
    avatar_url              TEXT NULL,
    referrer_id             UUID NULL REFERENCES profiles(id),
    is_subscribed           BOOLEAN DEFAULT FALSE,
    subscription_checked_at TIMESTAMPTZ NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_profiles_no_self_referral CHECK (referrer_id != id)
);

-- Индекс для поиска по tg_id (уже UNIQUE, но для полноты)
CREATE INDEX IF NOT EXISTS idx_profiles_tg_id ON profiles(tg_id);

-- Индекс для поиска рефералов
CREATE INDEX IF NOT EXISTS idx_profiles_referrer_id ON profiles(referrer_id);

-- Триггер автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. qualifications — квалификационный опрос (1:1 с profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS qualifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    tension_sphere      VARCHAR NOT NULL,
    tension_level       VARCHAR NOT NULL,
    previous_attempts   VARCHAR NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_qualifications_updated
    BEFORE UPDATE ON qualifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. test_results — результаты теста (1:1 с profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS test_results (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    score_s          SMALLINT NOT NULL DEFAULT 0 CHECK (score_s >= 0),
    score_u          SMALLINT NOT NULL DEFAULT 0 CHECK (score_u >= 0),
    score_p          SMALLINT NOT NULL DEFAULT 0 CHECK (score_p >= 0),
    score_r          SMALLINT NOT NULL DEFAULT 0 CHECK (score_r >= 0),
    score_k          SMALLINT NOT NULL DEFAULT 0 CHECK (score_k >= 0),
    dominant_trait   VARCHAR(1) NOT NULL CHECK (dominant_trait IN ('S','U','P','R','K')),
    secondary_trait  VARCHAR(1) NOT NULL CHECK (secondary_trait IN ('S','U','P','R','K')),
    answers          JSONB NOT NULL DEFAULT '[]',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_traits_different CHECK (dominant_trait != secondary_trait)
);

CREATE TRIGGER trg_test_results_updated
    BEFORE UPDATE ON test_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. referrals — реферальные связи (N:M через owner→invited)
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES profiles(id),
    invited_id  UUID NOT NULL REFERENCES profiles(id),
    status      VARCHAR NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','subscribed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, invited_id),
    CONSTRAINT chk_referrals_no_self CHECK (owner_id != invited_id)
);

-- Индекс для лимита за период
CREATE INDEX IF NOT EXISTS idx_referrals_owner_created ON referrals(owner_id, created_at);

-- Индекс для проверки петель
CREATE INDEX IF NOT EXISTS idx_referrals_invited ON referrals(invited_id);

CREATE TRIGGER trg_referrals_updated
    BEFORE UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. referral_log — аудит реферальных действий (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID NOT NULL REFERENCES profiles(id),
    action      VARCHAR NOT NULL,
    details     JSONB NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_log_profile ON referral_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_referral_log_created ON referral_log(created_at);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_log ENABLE ROW LEVEL SECURITY;

-- profiles: пользователь видит/обновляет только свой профиль
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- qualifications: пользователь видит/вставляет только свои
CREATE POLICY "qualifications_select_own" ON qualifications
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "qualifications_insert_own" ON qualifications
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "qualifications_update_own" ON qualifications
    FOR UPDATE USING (auth.uid() = profile_id);

-- test_results: пользователь видит/вставляет только свои
CREATE POLICY "test_results_select_own" ON test_results
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "test_results_insert_own" ON test_results
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- referrals: пользователь видит свои (как owner, так и invited)
CREATE POLICY "referrals_select_own" ON referrals
    FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = invited_id);

-- referral_log: SELECT запрещён для пользователей (только service_role)
-- INSERT только через service_role — политики для пользователей НЕ создаём
