-- EVA Database: Consolidated Initial Schema
-- Based on LOGIC.md (Source of Truth)
-- Created: 2026-04-26

-- ============================================================
-- 1. profiles — пользовательские профили
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tg_id                   BIGINT UNIQUE NOT NULL,
    username                TEXT NULL,
    first_name              TEXT NULL,
    last_name               TEXT NULL,
    avatar_url              TEXT NULL,
    is_subscribed           BOOLEAN DEFAULT FALSE,
    current_step            INTEGER DEFAULT NULL,
    question_order          SMALLINT[] DEFAULT NULL,
    last_test_date          TIMESTAMPTZ DEFAULT NULL,
    last_bot_interaction    TIMESTAMPTZ DEFAULT NULL,
    reminded_at             TIMESTAMPTZ DEFAULT NULL,
    bot_quiz_step           INTEGER DEFAULT 0,
    referred_by             BIGINT NULL,
    referrer_id             UUID NULL REFERENCES profiles(id),
    referral_confirmed      BOOLEAN DEFAULT FALSE,
    referral_confirmed_at   TIMESTAMPTZ DEFAULT NULL,
    invites_count           INTEGER DEFAULT 0,
    shared_at               TIMESTAMPTZ DEFAULT NULL,
    contact_author_clicked  BOOLEAN DEFAULT FALSE,
    mixed_trait_sent        BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tg_id ON profiles(tg_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referrer_id ON profiles(referrer_id);

-- ============================================================
-- 2. test_results — результаты теста (1:1 с profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS test_results (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tg_id            BIGINT UNIQUE NOT NULL REFERENCES profiles(tg_id) ON DELETE CASCADE,
    profile_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    primary_support  TEXT NOT NULL,
    secondary_support TEXT NOT NULL,
    score_s          INTEGER NOT NULL DEFAULT 0,
    score_u          INTEGER NOT NULL DEFAULT 0,
    score_p          INTEGER NOT NULL DEFAULT 0,
    score_r          INTEGER NOT NULL DEFAULT 0,
    score_k          INTEGER NOT NULL DEFAULT 0,
    answers          JSONB NOT NULL DEFAULT '[]',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_profile_id ON test_results(profile_id);

-- ============================================================
-- 3. qualifications — квалификационный опрос (1:1 с profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS qualifications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id              UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    current_tension_sphere  TEXT NOT NULL,
    tension_severity        TEXT NOT NULL,
    previous_experience     TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. bot_tasks_queue — очередь отложенных задач
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_tasks_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tg_id           BIGINT NOT NULL,
    event_type      TEXT NOT NULL,
    run_at          TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending, processing, processed, failed
    error_message   TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_tasks_queue_pending ON bot_tasks_queue(run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bot_tasks_queue_tg_id ON bot_tasks_queue(tg_id);
CREATE INDEX IF NOT EXISTS idx_bot_tasks_queue_profile_id ON bot_tasks_queue(profile_id);

-- ============================================================
-- 5. RPC & TRIGGERS
-- ============================================================

-- Trigger to sync referred_by to referrer_id
CREATE OR REPLACE FUNCTION sync_referred_by_to_referrer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referred_by IS NOT NULL AND NEW.referrer_id IS NULL THEN
        SELECT id INTO NEW.referrer_id FROM profiles WHERE tg_id = NEW.referred_by LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_referrer
    BEFORE INSERT OR UPDATE OF referred_by ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_referred_by_to_referrer();
