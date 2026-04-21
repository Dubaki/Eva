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
    let referrerId: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload?.sub) profileId = payload.sub
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    if (profileId) {
      const { data } = await supabaseAdmin.from('profiles').select('tg_id, referrer_id').eq('id', profileId).limit(1)
      if (data && data.length > 0) {
        tgId = data[0].tg_id
        referrerId = data[0].referrer_id
      }
    }

    if (!tgId && bodyTgId) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, tg_id, referrer_id').eq('tg_id', bodyTgId).limit(1)
      if (profiles && profiles.length > 0) {
        profileId = profiles[0].id
        tgId = profiles[0].tg_id
        referrerId = profiles[0].referrer_id
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
      // Ищем профиль ТЕКУЩЕГО пользователя по tgId (который мы только что сохранили)
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, referred_by, referrer_id')
        .eq('tg_id', tgId)
        .single()

      if (currentProfile && currentProfile.referred_by && !currentProfile.referrer_id) {
        const inviterTgId = currentProfile.referred_by
        
        // Ищем профиль ПРИГЛАСИВШЕГО
        const { data: inviterProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, tg_id, invites_count, dominant_trait, shadow_trait')
          .eq('tg_id', inviterTgId)
          .single()

          if (inviterProfile) {
            const newCount = (inviterProfile.invites_count ?? 0) + 1

            // 1. Обновляем счетчик пригласившему (это само триггернет Edge Function через Вебхук БД)
            await supabaseAdmin
              .from('profiles')
              .update({ invites_count: newCount })
              .eq('id', inviterProfile.id)

            // 2. Связываем реферала с пригласившим
            await supabaseAdmin
              .from('profiles')
              .update({ referrer_id: inviterProfile.id })
              .eq('id', currentProfile.id)

            console.log(`[Referral] Updated count to ${newCount} for inviter ${inviterProfile.tg_id}`)
          }
        }

        // ── Self Reward Logic ─────────────────────────────────────────────
        // Здесь мы тоже можем просто положиться на БД, либо оставить вызов,
        // но для единообразия лучше просто убедиться, что invites_count уже >= 2.
        // Если пользователь с 2 рефералами завершил тест — Вебхук на INSERT в test_results
        // или UPDATE в profiles может сработать. Но так как счетчик уже 2 и не МЕНЯЕТСЯ,
        // нам нужно оставить здесь один прямой вызов для тех, кто УЖЕ имеет 2 реферала
        // на момент первого прохождения теста.
        
        const { data: updatedSelf } = await supabaseAdmin
          .from('profiles')
          .select('invites_count')
          .eq('tg_id', tgId)
          .single()

        if (updatedSelf && (updatedSelf.invites_count ?? 0) >= 2) {
          const mixedKey = [primary.toUpperCase(), secondary.toUpperCase()]
            .sort()
            .join('')
          
          await triggerBotNotification({
            event: 'referrals_reached_2',
            profile_id: currentProfile.id,
            tg_id: tgId,
            mixed_trait: mixedKey,
          })
        }
      }
 catch (refErr) {
      console.error('[Referral] Critical error:', refErr)
    }

    return NextResponse.json({ success: true, data: { dominantTrait: scores.dominantTrait, scores } })
  } catch (err) {
    console.error('[API] Submit error:', err)
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}