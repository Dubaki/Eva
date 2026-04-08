import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { calculateScores, type Answer } from '@/lib/scoring'

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
        a.score < 1 ||
        a.score > 5
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

    // Если токена нет — используем guest-режим (данные сохраняются, но без привязки к профилю)
    let supabase: ReturnType<typeof getSupabaseServer> | null = null

    if (token) {
      supabase = getSupabaseServer()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token)

      if (authError || !user) {
        // Токен невалиден — fallback на guest
        console.warn('[test/submit] Invalid token, falling back to guest mode')
        supabase = null
      } else {
        profileId = user.id
      }
    }

    if (!supabase) {
      supabase = getSupabaseServer()
    }

    // Рассчитываем баллы
    const scores = calculateScores(answers)

    // Сохраняем в БД
    if (profileId) {
      // Авторизованный пользователь — UPSERT по profile_id
      const { error: dbError } = await supabase.from('test_results').upsert(
        {
          profile_id: profileId,
          score_s: scores.scoreS,
          score_u: scores.scoreU,
          score_p: scores.scoreP,
          score_r: scores.scoreR,
          score_k: scores.scoreK,
          dominant_trait: scores.dominantTrait,
          secondary_trait: scores.secondaryTrait,
          answers: scores.answers,
        },
        {
          onConflict: 'profile_id',
        }
      )

      if (dbError) {
        console.error('DB error:', dbError)
        return NextResponse.json(
          { success: false, error: 'Ошибка сохранения результатов' },
          { status: 500 }
        )
      }

      await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', profileId)
    } else {
      // Guest — нет profile_id, пропускаем запись в БД
      // Результат всё равно вернём клиенту — он сохранит в sessionStorage
      console.log('[test/submit] Guest mode: returning result without DB storage')
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
