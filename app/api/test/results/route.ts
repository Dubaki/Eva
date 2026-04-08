import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

/**
 * GET /api/test/results
 * Returns the user's latest test results.
 * Used as a fallback when sessionStorage doesn't persist (e.g., Telegram WebView).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Отсутствует токен авторизации' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
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

    const { data, error } = await supabase
      .from('test_results')
      .select('dominant_trait, secondary_trait, score_s, score_u, score_p, score_r, score_k')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Результаты не найдены' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        dominantTrait: data.dominant_trait,
        secondaryTrait: data.secondary_trait,
        scores: {
          S: data.score_s,
          U: data.score_u,
          P: data.score_p,
          R: data.score_r,
          K: data.score_k,
        },
      },
    })
  } catch (err) {
    console.error('Unexpected error in /api/test/results:', err)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
