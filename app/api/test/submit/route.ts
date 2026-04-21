import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { calculateScores, type Answer } from '@/lib/scoring'
import { QUESTIONS } from '@/lib/questions'
import { FULL_RESULTS_TEXTS } from '@/lib/constants/results'
import { sendPhoto, sendMessage } from '@/lib/telegram-bot'
import { triggerBotNotification } from '@/lib/bot-notification'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return NextResponse.json({ success: false, error: 'Config error' }, { status: 500 })

  try {
    const body = await request.json()
    const answers: Answer[] = body.answers
    const bodyTgId = body.tgId
    
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return NextResponse.json({ success: false, error: 'Invalid answers count' }, { status: 400 })
    }

    let profileId: string | null = null
    let tgId: number | null = null
    let referrerId: string | null = null // This is the UUID of inviter if ALREADY processed
    let referredBy: number | null = null // This is the TG ID of inviter if NOT YET processed

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload?.sub) profileId = payload.sub
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    if (profileId) {
      const { data } = await supabaseAdmin.from('profiles').select('tg_id, referrer_id, referred_by').eq('id', profileId).limit(1)
      if (data && data.length > 0) {
        tgId = data[0].tg_id
        referrerId = data[0].referrer_id
        referredBy = data[0].referred_by
      }
    }

    if (!tgId && bodyTgId) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, tg_id, referrer_id, referred_by').eq('tg_id', bodyTgId).limit(1)
      if (profiles && profiles.length > 0) {
        profileId = profiles[0].id
        tgId = profiles[0].tg_id
        referrerId = profiles[0].referrer_id
        referredBy = profiles[0].referred_by
      }
    }

    if (!profileId || !tgId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    const { error: dbError } = await supabaseAdmin.rpc('save_test_result', {
      p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary,
    })
    if (dbError) return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })

    await supabaseAdmin.from('profiles').update({ current_step: null, question_order: null }).eq('id', profileId)
    
    // ── Настройка Telegram (ОДНО СООБЩЕНИЕ) ──
    const fullText = FULL_RESULTS_TEXTS[primary]
    const TRAIT_IMAGES_MAP: Record<string, string> = {
      S: 'hero.png', 
      U: 'pleaser.png', 
      P: 'perfectionist.png', 
      R: 'stayer.png', 
      K: 'controller.png'
    }

    const imageName = TRAIT_IMAGES_MAP[primary] || 'hero.png'
    // Используем проверенный путь к GitHub Raw
    const githubRawBase = 'https://raw.githubusercontent.com/Dubaki/Eva/main/public'
    const photoUrl = `${githubRawBase}/${imageName}`

    try {
      // Отправляем ОДНО сообщение: фото и текст в caption
      const sent = await sendPhoto({ 
        chatId: tgId, 
        photo: photoUrl,
        caption: fullText,
        parseMode: 'HTML'
      });

      // Резервный вариант: если Telegram отклонил фото (например, текст > 1024 символов)
      if (!sent) {
        console.warn('[API] Photo with caption failed, sending separately...');
        await sendMessage({
          chatId: tgId,
          text: fullText,
          parseMode: 'HTML'
        });
      }
      
      console.log(`[API] Unified result sent. Trait: ${primary}`);
    } catch (err) {
      console.error('[API] Telegram delivery critical error:', err);
      // Финальный фолбэк — просто текст, если всё упало
      await sendMessage({ chatId: tgId, text: fullText, parseMode: 'HTML' }).catch(() => {});
    }

    // ── Добавляем задачу в очередь для бота (через 1 минуту) ──
    try {
      await supabaseAdmin.from('bot_tasks_queue').insert({
        profile_id: profileId,
        tg_id: tgId,
        event_type: 'start_mini_quiz',
        run_at: new Date(Date.now() + 60000).toISOString(),
        status: 'pending'
      });
      console.log(`[API] Bot task 'start_mini_quiz' scheduled for ${tgId}`);
    } catch (queueErr) {
      console.error('[API] Failed to schedule bot task:', queueErr);
      // Не прерываем основной поток, если очередь не сработала
    }

    // ── Referral Reward Logic (for the referrer) ──────────────────────
    try {
      console.log(`[Referral] Checking for ${tgId}. referredBy=${referredBy}, referrerId=${referrerId}`);
      
      // Если есть тот, кто пригласил (referredBy — это TG ID), 
      // и мы еще не засчитали его (referrerId — это UUID)
      if (referredBy && !referrerId) {
        // Ищем профиль пригласившего по его TG ID
        const { data: inviter } = await supabaseAdmin
          .from('profiles')
          .select('id, tg_id, invites_count')
          .eq('tg_id', referredBy)
          .maybeSingle();

        if (inviter) {
          const newCount = (inviter.invites_count ?? 0) + 1;
          console.log(`[Referral] Found inviter ${inviter.tg_id}. Incrementing to ${newCount}`);

          // 1. Обновляем счетчик пригласившему
          const { error: updErr1 } = await supabaseAdmin
            .from('profiles')
            .update({ invites_count: newCount })
            .eq('id', inviter.id);

          if (updErr1) console.error('[Referral] Error updating inviter count:', updErr1);

          // 2. Отмечаем текущего пользователя как "обработанного" (записываем UUID пригласившего)
          const { error: updErr2 } = await supabaseAdmin
            .from('profiles')
            .update({ referrer_id: inviter.id })
            .eq('id', profileId);

          if (updErr2) console.error('[Referral] Error updating current profile referrer_id:', updErr2);

          console.log(`[Referral] Success! Inviter ${inviter.tg_id} now has ${newCount} invites.`);
        } else {
          console.log(`[Referral] Inviter with TG ID ${referredBy} not found in database.`);
        }
      }

      // ── Self Reward Logic (if current user has 2+ invites) ─────────────
      // Проверяем, не пора ли самому пользователю получить подарок
      const { data: selfProfile } = await supabaseAdmin
        .from('profiles')
        .select('invites_count')
        .eq('id', profileId)
        .maybeSingle();

      if (selfProfile && (selfProfile.invites_count ?? 0) >= 2) {
        console.log(`[Referral] User ${tgId} has ${selfProfile.invites_count} invites. Sending bonus.`);
        
        // Ключ для подарка — сортировка по алфавиту primary + secondary
        const mixedKey = [primary.toUpperCase(), secondary.toUpperCase()]
          .sort()
          .join('');
        
        await triggerBotNotification({
          event: 'referrals_reached_2',
          profile_id: profileId!,
          tg_id: tgId!,
          mixed_trait: mixedKey,
        });
      }
    } catch (refErr) {
      console.error('[Referral] Critical error in referral logic:', refErr);
    }

    return NextResponse.json({ success: true, data: { dominantTrait: scores.dominantTrait, scores } })
  } catch (err) {
    console.error('[API] Submit error:', err)
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}