-- Migration 099: Update submit_test_result_v2 to use referral_confirmed flag and insert into referrals table
-- Мы обновляем RPC-функцию, чтобы она использовала новый флаг подтверждения реферала
-- и поддерживала целостность в таблице referrals.

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
    RETURNING referred_by, referrer_id, referral_confirmed INTO v_referred_by, v_referrer_id, v_referral_confirmed;

    -- 3. Обработка реферальной логики
    IF v_referred_by IS NOT NULL AND (v_referral_confirmed IS FALSE OR v_referral_confirmed IS NULL) THEN
        -- inviter_id может быть уже в v_referrer_id (благодаря триггеру) или ищем по v_referred_by
        v_inviter_id := v_referrer_id;
        IF v_inviter_id IS NULL THEN
            SELECT id INTO v_inviter_id FROM profiles WHERE tg_id = v_referred_by LIMIT 1;
        END IF;
        
        IF v_inviter_id IS NOT NULL THEN
            -- Начисляем бонус пригласившему
            UPDATE profiles SET invites_count = COALESCE(invites_count, 0) + 1 WHERE id = v_inviter_id;
            
            -- Помечаем реферал как подтвержденный в профиле
            UPDATE profiles 
            SET 
                referrer_id = v_inviter_id,
                referral_confirmed = TRUE,
                referral_confirmed_at = NOW()
            WHERE id = p_profile_id;

            -- Также добавляем/обновляем запись в таблице referrals
            INSERT INTO referrals (owner_id, invited_id, status)
            VALUES (v_inviter_id, p_profile_id, 'passed_test')
            ON CONFLICT (owner_id, invited_id) DO UPDATE SET
                status = 'passed_test',
                updated_at = NOW();
            
            v_result := jsonb_build_object('referral_processed', true, 'inviter_id', v_inviter_id);
        ELSE
            v_result := jsonb_build_object('referral_processed', false, 'reason', 'inviter_not_found');
        END IF;
    ELSE
        v_result := jsonb_build_object('referral_processed', false, 'reason', 'already_confirmed_or_no_referrer');
    END IF;

    RETURN v_result;
END;
$$;
