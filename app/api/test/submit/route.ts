import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { calculateScores, type Answer } from '@/lib/scoring'
import { QUESTIONS } from '@/lib/questions'
import { sendPhoto, sendMessage } from '@/lib/telegram-bot'
import { RESULT_TEXTS } from '@/lib/constants/texts'

export const dynamic = 'force-dynamic'

const TRAIT_IMAGES: Record<string, string> = {
  S: 'hero.png',
  U: 'pleaser.png',
  P: 'perfectionist.png',
  R: 'stayer.png',
  K: 'controller.png',
}

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

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload?.sub) profileId = payload.sub
    }

    if (!profileId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: profile } = await supabaseAdmin.from('profiles').select('tg_id').eq('id', profileId).maybeSingle()
    if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })

    const tgId = profile.tg_id

    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    console.log(`[API] Submitting test for tgId: ${tgId}, profileId: ${profileId}`);
    console.log(`[API] Scores:`, scores);

    // 1. Сохраняем результат теста (UPSERT)
    const { error: trError } = await supabaseAdmin.from('test_results').upsert({
      tg_id: tgId,
      profile_id: profileId,
      primary_support: primary,
      secondary_support: secondary,
      answers: answers as any,
      score_s: scores.scoreS,
      score_u: scores.scoreU,
      score_p: scores.scoreP,
      score_r: scores.scoreR,
      score_k: scores.scoreK,
      created_at: new Date().toISOString()
    }, { onConflict: 'tg_id' })

    if (trError) {
      console.error('[API] test_results upsert error:', trError)
      return NextResponse.json({ success: false, error: 'Ошибка сохранения результатов: ' + trError.message }, { status: 500 })
    }

    // 2. Обновляем профиль пользователя (по tg_id для надежности)
    const { data: updatedProfile, error: profError } = await supabaseAdmin.from('profiles').update({
      current_step: null,
      question_order: null,
      reminded_at: null,
      mixed_trait_sent: false,
      last_test_date: new Date().toISOString()
    }).eq('tg_id', tgId).select('referred_by, referrer_id, referral_confirmed').single()

    if (profError) {
      console.error('[API] profiles update error:', profError)
      return NextResponse.json({ success: false, error: 'Ошибка обновления профиля: ' + profError.message }, { status: 500 })
    }

    // 3. Ставим задачи в очередь (просто INSERT, так как уникального индекса для upsert нет)
    try {
      await supabaseAdmin.from('bot_tasks_queue').insert([
        { 
          profile_id: profileId, 
          tg_id: tgId, 
          event_type: 'cooldown_reminder', 
          run_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        { 
          profile_id: profileId, 
          tg_id: tgId, 
          event_type: 'start_qualification', 
          run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }
      ])
    } catch (err) {
      console.error('[API] Failed to queue tasks (non-fatal):', err)
    }

    // 4. Реферальная логика
    let referralProcessed = false
    try {
      if (updatedProfile && updatedProfile.referred_by && !updatedProfile.referral_confirmed) {
        // Ищем пригласившего по его tg_id
        const { data: inviter } = await supabaseAdmin
          .from('profiles')
          .select('id, invites_count')
          .eq('tg_id', updatedProfile.referred_by)
          .maybeSingle()

        if (inviter) {
          // 1. Увеличиваем счетчик пригласившему
          await supabaseAdmin
            .from('profiles')
            .update({ invites_count: (inviter.invites_count || 0) + 1 })
            .eq('id', inviter.id)

          // 2. Помечаем текущего пользователя как подтвержденного
          await supabaseAdmin
            .from('profiles')
            .update({
              referrer_id: inviter.id,
              referral_confirmed: true,
              referral_confirmed_at: new Date().toISOString()
            })
            .eq('id', profileId)

          referralProcessed = true
          console.log(`[API] Referral confirmed: inviter ${inviter.id} got +1`);
        }
      }
    } catch (err) {
      console.error('[API] Referral logic error (non-fatal):', err)
    }

    console.log(`[API] Test submitted successfully for ${tgId}`);

    return NextResponse.json({
      success: true,
      data: {
        primary_support: primary,
        secondary_support: secondary,
        referralProcessed: referralProcessed
      }
    })
  } catch (err) {
    console.error('[API] Submit error:', err)
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}
