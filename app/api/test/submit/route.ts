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
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Отсутствует токен авторизации' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // ── Debug bypass (development only) ──────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString(),
        )
        if (payload.sub === '00000000-0000-0000-0000-000000000001') {
          const scores = calculateScores(answers)
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
        }
      } catch { /* not a debug token — continue normal flow */ }
    }

    // Верифицируем JWT через Supabase
    const supabase = getSupabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Невалидный токен' },
        { status: 401 }
      )
    }

    profileId = user.id

    // Рассчитываем баллы
    const scores = calculateScores(answers)

    // Сохраняем в БД (UPSERT — один результат на пользователя)
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

    // Обновляем дату следующего доступного теста (через 2 месяца)
    const twoMonthsLater = new Date()
    twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)

    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', profileId)

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
