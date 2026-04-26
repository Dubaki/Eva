-- Migration 002: RPC functions
-- Based on LOGIC.md (Source of Truth)

CREATE OR REPLACE FUNCTION submit_test_result_v2(
    p_tg_id BIGINT,
    p_profile_id UUID,
    p_primary TEXT,
    p_secondary TEXT,
    p_answers JSONB,
    p_score_s INTEGER,
    p_score_u INTEGER,
    p_score_p INTEGER,
    p_score_r INTEGER,
    p_score_k INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referred_by BIGINT;
    v_referrer_id UUID;
    v_referral_confirmed BOOLEAN;
    v_inviter_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Сохраняем результат теста (UPSERT)
    INSERT INTO test_results (
        tg_id,
        profile_id,
        primary_support,
        secondary_support,
        answers,
        score_s,
        score_u,
        score_p,
        score_r,
        score_k,
        created_at
    )
    VALUES (
        p_tg_id,
        p_profile_id,
        p_primary,
        p_secondary,
        p_answers,
        p_score_s,
        p_score_u,
        p_score_p,
        p_score_r,
        p_score_k,
        NOW()
    )
    ON CONFLICT (tg_id) DO UPDATE SET
        primary_support = EXCLUDED.primary_support,
        secondary_support = EXCLUDED.secondary_support,
        answers = EXCLUDED.answers,
        score_s = EXCLUDED.score_s,
        score_u = EXCLUDED.score_u,
        score_p = EXCLUDED.score_p,
        score_r = EXCLUDED.score_r,
        score_k = EXCLUDED.score_k,
        created_at = NOW();

    -- 2. Обновляем профиль пользователя
    UPDATE profiles
    SET
        current_step = NULL,
        question_order = NULL,
        reminded_at = NULL,
        mixed_trait_sent = FALSE,
        last_test_date = NOW()
    WHERE id = p_profile_id
    RETURNING referred_by, referrer_id, referral_confirmed INTO v_referred_by, v_referrer_id, v_referral_confirmed;

    -- 3. Добавляем задачи в очередь (если нет активных)
    IF NOT EXISTS (SELECT 1 FROM bot_tasks_queue WHERE profile_id = p_profile_id AND event_type = 'cooldown_reminder' AND status = 'pending') THEN
        INSERT INTO bot_tasks_queue (profile_id, tg_id, event_type, run_at, status)
        VALUES (p_profile_id, p_tg_id, 'cooldown_reminder', NOW() + INTERVAL '60 days', 'pending');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM bot_tasks_queue WHERE profile_id = p_profile_id AND event_type = 'start_qualification' AND status = 'pending') THEN
        INSERT INTO bot_tasks_queue (profile_id, tg_id, event_type, run_at, status)
        VALUES (p_profile_id, p_tg_id, 'start_qualification', NOW() + INTERVAL '24 hours', 'pending');
    END IF;

    -- 4. Обработка реферала
    IF v_referred_by IS NOT NULL AND v_referral_confirmed IS FALSE THEN
        SELECT id INTO v_inviter_id FROM profiles WHERE tg_id = v_referred_by LIMIT 1;
        IF v_inviter_id IS NOT NULL THEN
            UPDATE profiles SET invites_count = invites_count + 1 WHERE id = v_inviter_id;
            UPDATE profiles SET referral_confirmed = TRUE, referral_confirmed_at = NOW() WHERE id = p_profile_id;
            v_result := jsonb_build_object('referral_processed', true);
        END IF;
    END IF;

    RETURN COALESCE(v_result, jsonb_build_object('referral_processed', false));
END;
$$;
