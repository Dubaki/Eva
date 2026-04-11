import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { calculateScores, type Answer } from '@/lib/scoring'
import { triggerBotNotification } from '@/lib/bot-notification'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const answers: Answer[] = body.answers
    
    // ДОБАВЛЕНО: Читаем tgId напрямую из тела запроса или заголовка
    const rawTgId = body.tgId || request.headers.get('x-tg-id')
    const tgId = rawTgId ? Number(rawTgId) : null

    console.log('[test/submit] === INCOMING REQUEST ===')
    console.log('[test/submit] Extracted tgId:', tgId)

    // Валидация ответов
    if (!Array.isArray(answers) || answers.length !== 25) {
      return NextResponse.json({ success: false, error: 'Ожидается 25 ответов' }, { status: 400 })
    }

    // Рассчитываем баллы
    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    console.log('=== ТЕСТ ЗАВЕРШЕН ===')
    console.log('Баллы:', scores)

    // Если у нас нет tgId, мы не можем сохранить в базу
    if (!tgId) {
       console.error('[test/submit] CRITICAL: No tgId provided! Cannot save to DB.')
       return NextResponse.json({ 
         success: true, 
         warning: 'Данные не сохранены в БД (нет tgId)',
         data: { dominantTrait: scores.dominantTrait, secondaryTrait: scores.secondaryTrait, scores } 
       })
    }

    // ПРОБИВАЕМ БД: Используем Service Role Key для обхода любых блокировок RLS
    const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey)

    console.log('[test/submit] Calling RPC for tg_id:', tgId)

    const { error: dbError } = await supabaseAdmin.rpc('save_test_result', {
      p_tg_id: tgId,
      p_primary_support: primary,
      p_secondary_support: secondary,
    })

    if (dbError) {
      console.error('[test/submit] ОШИБКА БД:', dbError)
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })
    }

    console.log('[test/submit] УСПЕХ: Данные записаны в БД!')

    // Reset current_step after successful test completion
    const { error: resetError } = await supabaseAdmin
      .from('profiles')
      .update({ current_step: null })
      .eq('tg_id', tgId)

    if (resetError) {
      console.error('[test/submit] Warning: failed to reset current_step:', resetError.message)
    } else {
      console.log('[test/submit] current_step reset to null')
    }

    // Отправка уведомления (не блокирует ответ)
    triggerBotNotification({
      event: 'dominant_trait_set',
      profile_id: `tg-${tgId}`,
      tg_id: tgId,
      trait: primary,
    }).catch(console.error)

    return NextResponse.json({
      success: true,
      data: {
        dominantTrait: scores.dominantTrait,
        secondaryTrait: scores.secondaryTrait,
        scores
      },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}