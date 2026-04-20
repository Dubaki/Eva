import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { calculateScores, type Answer } from '@/lib/scoring'
import { triggerBotNotification } from '@/lib/bot-notification'
import { QUESTIONS } from '@/lib/questions'
import { FULL_RESULTS_TEXTS } from '@/lib/constants/results'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('\n--- [API/TEST/SUBMIT] ЗАПУСК СОХРАНЕНИЯ ТЕСТА ---')
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    console.error('[API] ОШИБКА: Нет SUPABASE_JWT_SECRET')
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 })
  }

  try {
    const body = await request.json()
    console.log('[API] 1. Получено тело запроса. tgId=', body.tgId, '| Ответов:', body.answers?.length)

    const answers: Answer[] = body.answers
    const bodyTgId = body.tgId
    
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      console.error('[API] ОШИБКА: Неверное количество ответов.')
      return NextResponse.json({ success: false, error: 'Неверное количество ответов' }, { status: 400 })
    }

    let profileId: string | null = null
    let tgId: number | null = null

    const authHeader = request.headers.get('authorization')
    console.log('[API] 2. Заголовок Auth:', authHeader ? 'Присутствует' : 'Отсутствует (пусто)')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload?.sub) {
        profileId = payload.sub
        console.log('[API] 3. JWT успешно расшифрован. profileId:', profileId)
      } else {
         console.log('[API] 3. JWT недействителен (пустой payload)')
      }
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    if (profileId) {
      console.log('[API] 4. Ищем tg_id по profileId...')
      const { data } = await supabaseAdmin.from('profiles').select('tg_id').eq('id', profileId).limit(1)
      if (data && data.length > 0) {
          tgId = data[0].tg_id
          console.log('[API] Успех! Найден tgId:', tgId)
      } else {
          console.log('[API] 4. JWT валиден, но профиль не найден по profileId. Пробую bodyTgId как фолбек.')
      }
    }

    // Fallback: JWT was missing/invalid OR JWT profile lookup found no tg_id
    if (!profileId || !tgId) {
      if (bodyTgId) {
        console.log('[API] 4. Ищем профиль по переданному tgId:', bodyTgId)
        const { data: profiles, error: searchErr } = await supabaseAdmin.from('profiles').select('id, tg_id').eq('tg_id', bodyTgId).limit(1)

        if (searchErr) console.error('[API] Ошибка поиска БД:', searchErr)

        if (profiles && profiles.length > 0) {
          profileId = profiles[0].id
          tgId = profiles[0].tg_id
          console.log('[API] Успех! Профиль найден в БД. profileId:', profileId)
        } else {
          console.log('[API] Профиль не найден. Пытаюсь создать (INSERT) новый профиль для tgId:', bodyTgId)
          const { data: newProfiles, error: insertError } = await supabaseAdmin.from('profiles')
            .insert([{ tg_id: bodyTgId, is_subscribed: true }])
            .select('id, tg_id')

          if (insertError) {
              console.error('[API] КРИТИЧЕСКАЯ ОШИБКА INSERT (БД отклонила создание):', insertError)
          } else if (newProfiles && newProfiles.length > 0) {
            profileId = newProfiles[0].id
            tgId = newProfiles[0].tg_id
            console.log('[API] Успех! Новый профиль создан. profileId:', profileId)
          }
        }
      } else {
          console.error('[API] ОШИБКА: Фронтенд не прислал ни токен, ни tgId в теле запроса!')
      }
    }

    if (!profileId || !tgId) {
      console.error('[API] ФИНАЛЬНЫЙ ОТКАЗ. profileId:', profileId, '| tgId:', tgId)
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization' }, { status: 401 })
    }

    console.log('[API] 5. Авторизация пройдена. Идет сохранение результатов...')
    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    const { error: dbError } = await supabaseAdmin.rpc('save_test_result', {
      p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary,
    })

    if (dbError) {
        console.error('[API] ОШИБКА RPC save_test_result:', dbError)
        return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })
    }

    await supabaseAdmin.from('profiles').update({ current_step: null, shared_at: null }).eq('id', profileId)
    
    const fullText = FULL_RESULTS_TEXTS[primary]
    triggerBotNotification({ 
      event: 'dominant_trait_set', 
      profile_id: profileId, 
      tg_id: tgId, 
      trait: primary,
      full_text: fullText 
    }).catch(() => {})

    console.log('[API] --- ТЕСТ УСПЕШНО СОХРАНЕН --- \n')
    return NextResponse.json({ success: true, data: { dominantTrait: scores.dominantTrait, secondaryTrait: scores.secondaryTrait, scores } })
  } catch (err) {
    console.error('[API] ФАТАЛЬНАЯ ОШИБКА СЕРВЕРА:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}