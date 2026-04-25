-- Migration 093: Create atomic test submission RPC
-- Эта функция заменяет сложную логику в API route, обеспечивая атомарность и скорость.

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
    v_inviter_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Сохраняем результат теста (INSERT или UPDATE)
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
        updated_at
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
        updated_at = NOW();

    -- 2. Обновляем профиль пользователя
    UPDATE profiles 
    SET 
        current_step = NULL, 
        question_order = NULL,
        reminded_at = NULL,
        last_test_date = NOW()
    WHERE id = p_profile_id
    RETURNING referred_by, referrer_id INTO v_referred_by, v_referrer_id;

    -- 3. Обработка реферальной логики
    IF v_referred_by IS NOT NULL AND v_referrer_id IS NULL THEN
        -- Ищем пригласившего
        SELECT id INTO v_inviter_id FROM profiles WHERE tg_id = v_referred_by LIMIT 1;
        
        IF v_inviter_id IS NOT NULL THEN
            -- Начисляем бонус пригласившему
            UPDATE profiles SET invites_count = COALESCE(invites_count, 0) + 1 WHERE id = v_inviter_id;
            
            -- Ставим "печать" текущему пользователю
            UPDATE profiles SET referrer_id = v_inviter_id WHERE id = p_profile_id;
            
            v_result := jsonb_build_object('referral_processed', true, 'inviter_id', v_inviter_id);
        ELSE
            v_result := jsonb_build_object('referral_processed', false, 'reason', 'inviter_not_found');
        END IF;
    ELSE
        v_result := jsonb_build_object('referral_processed', false, 'reason', 'not_a_new_referral');
    END IF;

    RETURN v_result;
END;
$$;
