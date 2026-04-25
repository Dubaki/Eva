import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseAdminUrl, supabaseAdminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    // 1. Ищем tgId в параметрах URL (?tgId=...) или в заголовках
    const { searchParams } = new URL(request.url)
    const rawTgId = searchParams.get('tgId') || request.headers.get('x-tg-id')
    const bodyTgId = rawTgId ? Number(rawTgId) : null

    let profileId: string | null = null

    // 2. Сначала пробуем получить токен (классический путь)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const jwtSecret = process.env.SUPABASE_JWT_SECRET
      if (jwtSecret) {
        const payload = verifyJwt(token, jwtSecret)
        if (payload?.sub) {
          profileId = payload.sub
        }
      }
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 3. БРОНЯ: Если токена нет, ищем профиль по tgId (с limit(1) от дубликатов)
    let tgIdToUse = bodyTgId
    if (!profileId && bodyTgId) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('tg_id', bodyTgId)
        .limit(1)

      if (profiles && profiles.length > 0) {
        profileId = profiles[0].id
      }
    } else if (profileId && !tgIdToUse) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('tg_id')
        .eq('id', profileId)
        .limit(1)
      if (profiles && profiles.length > 0) {
        tgIdToUse = profiles[0].tg_id
      }
    }

    // Если всё равно ничего нет — отбиваем
    if (!profileId || !tgIdToUse) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization' },
        { status: 401 }
      )
    }

    // 4. Загружаем результаты (safely with maybeSingle)
    const { data: result, error } = await supabaseAdmin
      .from('test_results')
      .select('primary_support, secondary_support, score_s, score_u, score_p, score_r, score_k')
      .eq('tg_id', tgIdToUse)
      .maybeSingle()

    if (error || !result) {
      return NextResponse.json(
        { success: false, error: 'Результаты не найдены' },
        { status: 404 }
      )
    }

    const data = result

    return NextResponse.json({
      success: true,
      data: {
        primarySupport: data.primary_support,
        secondarySupport: data.secondary_support,
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
    console.error('[test/results] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}