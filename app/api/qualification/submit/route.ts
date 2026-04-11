import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tension_sphere, tension_level, previous_attempts } = body

    // Валидация
    if (!tension_sphere || !tension_level || !previous_attempts) {
      return NextResponse.json(
        { success: false, error: 'Все поля обязательны' },
        { status: 400 }
      )
    }

    // Авторизация
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    let profileId: string | undefined
    const supabase = getSupabaseServer()

    if (token) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token)

      if (authError || !user) {
        console.warn('[qualification/submit] Invalid token, falling back to guest mode')
      } else {
        profileId = user.id
      }
    }

    // Сохраняем квалификацию (UPSERT — одна на пользователя), если есть profileId
    if (profileId) {
      const { error: dbError } = await supabase.from('qualifications').upsert(
        {
          profile_id: profileId,
          tension_sphere,
          tension_level,
          previous_attempts,
        },
        { onConflict: 'profile_id' }
      )

      if (dbError) {
        console.error('DB error:', dbError)
        return NextResponse.json(
          { success: false, error: 'Ошибка сохранения' },
          { status: 500 }
        )
      }
    } else {
      console.log('[qualification/submit] Guest mode: returning result without DB storage')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error in /api/qualification/submit:', err)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
