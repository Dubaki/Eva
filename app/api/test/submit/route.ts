import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { calculateScores, type Answer } from '@/lib/scoring'
import { sendPhotoToUser, MIXED_TRAIT_TEXTS } from '@/lib/telegram'
import { triggerBotNotification } from '@/lib/bot-notification'

const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000 // 60 days in ms
const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

export async function POST(request: NextRequest) {
  let profileId: string | undefined

  try {
    const body = await request.json()
    const answers: Answer[] = body.answers

    // Валидация входных данных
    if (!Array.isArray(answers) || answers.length !== 25) {
      return NextResponse.json(
        { success: false, error: 'Ожидается массив из 25 ответов' },
        { status: 400 }
      )
    }

    // Валидация каждого ответа
    for (const a of answers) {
      if (
        typeof a !== 'object' ||
        typeof a.questionId !== 'number' ||
        typeof a.score !== 'number' ||
        a.score < 0 ||
        a.score > 1
      ) {
        return NextResponse.json(
          { success: false, error: `Некорректный ответ: ${JSON.stringify(a)}` },
          { status: 400 }
        )
      }
    }

    // Получаем profile_id из Authorization заголовка (JWT от /api/auth)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    console.log('[test/submit] === INCOMING REQUEST ===')
    console.log('[test/submit] Auth header present:', !!authHeader)
    console.log('[test/submit] Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NONE')

    // Decode JWT payload for debugging (without verification)
    if (token) {
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
          console.log('[test/submit] Decoded JWT payload:', {
            sub: payload.sub,
            iss: payload.iss,
            role: payload.role,
            exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A',
            isOffline: payload.sub?.startsWith?.('offline-'),
          })
        }
      } catch {
        console.log('[test/submit] Could not decode JWT token')
      }
    }

    // Если токена нет — используем guest-режим (данные сохраняются, но без привязки к профилю)
    let supabase: ReturnType<typeof getSupabaseServer> | null = null
    let offlineTgId: number | null = null // для распознавания синтетических offline-токенов

    if (token) {
      supabase = getSupabaseServer()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token)

      console.log('[test/submit] auth.getUser result:', {
        hasUser: !!user,
        userId: user?.id,
        authError: authError?.message ?? null,
      })

      if (authError || !user) {
        // Проверяем, это синтетический offline-токен?
        // Формат sub: "offline-{tg_id}-{timestamp}"
        try {
          const parts = token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
            if (payload.sub?.startsWith?.('offline-')) {
              const tgIdStr = payload.sub.split('-')[1]
              const parsedTgId = parseInt(tgIdStr, 10)
              if (!isNaN(parsedTgId)) {
                offlineTgId = parsedTgId
                console.log('[test/submit] Detected offline token, extracted tg_id:', offlineTgId)
              }
            }
          }
        } catch {
          console.warn('[test/submit] Invalid token, falling back to guest mode')
        }

        if (!offlineTgId) {
          console.warn('[test/submit] Invalid token, falling back to guest mode')
          supabase = null
        }
        // Если offlineTgId извлечён — продолжаем с supabase, но profileId будет null
      } else {
        profileId = user.id
      }
    }

    if (!supabase) {
      supabase = getSupabaseServer()
    }

    console.log('[test/submit] Final profileId:', profileId ?? (offlineTgId ? `offline(tg:${offlineTgId})` : 'GUEST MODE'))

    // ── Cooldown check: if user already has a result, check last_test_date ──
    // Skip for tester IDs (God mode)
    if (profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_test_date, tg_id')
        .eq('id', profileId)
        .single()

      if (profile?.tg_id && !TESTER_IDS.includes(String(profile.tg_id)) && profile?.last_test_date) {
        const lastTest = new Date(profile.last_test_date).getTime()
        const now = Date.now()
        const elapsed = now - lastTest
        if (elapsed < COOLDOWN_MS) {
          const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
          console.log(`[test/submit] Cooldown active: ${daysLeft} days remaining for profile ${profileId}`)
          return NextResponse.json(
            { success: false, error: `cooldown`, daysLeft },
            { status: 429 }
          )
        }
      }
    } else if (offlineTgId) {
      // Cooldown check для offline режима — ищем по tg_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_test_date, tg_id')
        .eq('tg_id', offlineTgId)
        .maybeSingle()

      if (profile && !TESTER_IDS.includes(String(profile.tg_id)) && profile?.last_test_date) {
        const lastTest = new Date(profile.last_test_date).getTime()
        const now = Date.now()
        const elapsed = now - lastTest
        if (elapsed < COOLDOWN_MS) {
          const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
          console.log(`[test/submit] Cooldown active (offline): ${daysLeft} days remaining for tg_id ${offlineTgId}`)
          return NextResponse.json(
            { success: false, error: `cooldown`, daysLeft },
            { status: 429 }
          )
        }
      }
    }

    // Рассчитываем баллы
    const scores = calculateScores(answers)

    // Get trait description for Telegram
    const { getTraitInfo } = await import('@/lib/scoring')
    const traitInfo = getTraitInfo(scores.dominantTrait)

    console.log('=== ТЕСТ ЗАВЕРШЕН ===')
    console.log('Баллы:', { S: scores.scoreS, U: scores.scoreU, P: scores.scoreP, R: scores.scoreR, K: scores.scoreK })
    console.log('Доминирующая:', scores.dominantTrait, 'Теневая:', scores.secondaryTrait)

    // Сохраняем в БД через RPC save_test_result
    if (profileId) {
      console.log('[test/submit] Saving to DB via RPC for profile:', profileId)
      try {
        // Получаем tg_id для RPC вызова
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('tg_id')
          .eq('id', profileId)
          .single()

        console.log('[test/submit] Profile lookup result:', {
          profileFound: !!profile,
          tg_id: profile?.tg_id ?? 'MISSING',
          profileError: profileErr?.message ?? null,
        })

        if (!profile?.tg_id) {
          console.error('[test/submit] Profile not found or missing tg_id for profile:', profileId)
          return NextResponse.json(
            { success: false, error: 'Профиль не найден' },
            { status: 404 }
          )
        }

        const tgId = Number(profile.tg_id)
        const primary = scores.dominantTrait.toUpperCase()
        const secondary = scores.secondaryTrait.toUpperCase()

        console.log('[test/submit] RPC call params:', { p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary })

        const { error: dbError, data: rpcData } = await supabase.rpc('save_test_result', {
          p_tg_id: tgId,
          p_primary_support: primary,
          p_secondary_support: secondary,
        })

        console.log('[test/submit] RPC response:', { dbError: dbError ? JSON.stringify(dbError) : 'null', rpcData })

        if (dbError) {
          console.error('ОШИБКА СОХРАНЕНИЯ В БД (RPC):', JSON.stringify(dbError))
          return NextResponse.json(
            { success: false, error: 'Ошибка сохранения результатов' },
            { status: 500 }
          )
        }

        console.log('[test/submit] DB save via RPC successful')

        // Fire-and-forget: send result to Telegram (legacy path)
        sendResultToTelegram(tgId, scores.dominantTrait, traitInfo.description)

        // Fire-and-forget: trigger Edge Function for bot notification
        triggerBotNotification({
          event: 'dominant_trait_set',
          profile_id: profileId,
          tg_id: tgId,
          trait: primary,
        }).catch((err) => console.error('[test/submit] Edge function trigger error:', err))
      } catch (error) {
        console.error('ОШИБКА СОХРАНЕНИЯ В БД:', error)
        return NextResponse.json(
          { success: false, error: 'Ошибка сохранения результатов' },
          { status: 500 }
        )
      }
    } else if (offlineTgId) {
      // Offline режим: синтетический токен, но tg_id известен — вызываем RPC напрямую
      console.log('[test/submit] Saving to DB via RPC for offline user, tg_id:', offlineTgId)
      try {
        const primary = scores.dominantTrait.toUpperCase()
        const secondary = scores.secondaryTrait.toUpperCase()

        console.log('[test/submit] RPC call params (offline):', { p_tg_id: offlineTgId, p_primary_support: primary, p_secondary_support: secondary })

        const { error: dbError, data: rpcData } = await supabase.rpc('save_test_result', {
          p_tg_id: offlineTgId,
          p_primary_support: primary,
          p_secondary_support: secondary,
        })

        console.log('[test/submit] RPC response (offline):', { dbError: dbError ? JSON.stringify(dbError) : 'null', rpcData })

        if (dbError) {
          console.error('ОШИБКА СОХРАНЕНИЯ В БД (RPC offline):', JSON.stringify(dbError))
          return NextResponse.json(
            { success: false, error: 'Ошибка сохранения результатов' },
            { status: 500 }
          )
        }

        console.log('[test/submit] DB save via RPC successful (offline)')

        // Fire-and-forget: send result to Telegram
        sendResultToTelegram(offlineTgId, scores.dominantTrait, traitInfo.description)

        // Fire-and-forget: trigger Edge Function for bot notification
        triggerBotNotification({
          event: 'dominant_trait_set',
          profile_id: `offline-${offlineTgId}`,
          tg_id: offlineTgId,
          trait: primary,
        }).catch((err) => console.error('[test/submit] Edge function trigger error:', err))
      } catch (error) {
        console.error('ОШИБКА СОХРАНЕНИЯ В БД (offline):', error)
        return NextResponse.json(
          { success: false, error: 'Ошибка сохранения результатов' },
          { status: 500 }
        )
      }
    } else {
      // Guest — нет profile_id, пропускаем запись в БД
      // Результат всё равно вернём клиенту — он сохранит в sessionStorage
      console.log('[test/submit] ⚠️ Guest mode: NO DB STORAGE — this is why data is empty in Supabase!')
      console.log('[test/submit] Guest mode reason: no valid JWT token or auth.getUser failed')
    }

    return NextResponse.json({
      success: true,
      data: {
        dominantTrait: scores.dominantTrait,
        secondaryTrait: scores.secondaryTrait,
        scores: {
          S: scores.scoreS,
          U: scores.scoreU,
          P: scores.scoreP,
          R: scores.scoreR,
          K: scores.scoreK,
        },
      },
    })
  } catch (err) {
    console.error('Unexpected error in /api/test/submit:', err)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * Fire-and-forget: send result to user's Telegram.
 * Called after successful DB save, does NOT block the response.
 */
async function sendResultToTelegram(tgId: number, dominantTrait: string, description: string) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const imgMap: Record<string, string> = {
      S: `${baseUrl}/hero.png`,
      U: `${baseUrl}/pleaser.png`,
      P: `${baseUrl}/perfectionist.png`,
      R: `${baseUrl}/stayer.png`,
      K: `${baseUrl}/controller.png`,
    }

    const photoUrl = imgMap[dominantTrait.toUpperCase()] ?? `${baseUrl}/hero.png`
    const caption = description.length > 800 ? description.slice(0, 800) + '…' : description

    console.log(`[sendResultToTelegram] Sending photo to tgId=${tgId}, photoUrl=${photoUrl}`)

    const photoSent = await sendPhotoToUser({
      chatId: tgId,
      photo: photoUrl,
      caption,
    })

    if (!photoSent) {
      // Fallback: send text only
      console.error('[sendResultToTelegram] sendPhoto failed, falling back to sendMessage')
      const { sendMessageToUser } = await import('@/lib/telegram')
      await sendMessageToUser({
        chatId: tgId,
        text: `<b>${dominantTrait}</b>\n\n${caption}`,
      })
    }
  } catch (err) {
    // Never throw — this is fire-and-forget
    console.error('[test/submit] sendResultToTelegram error (non-fatal):', err)
  }
}
