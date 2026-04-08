import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

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

    const profileId = user.id

    // Сохраняем квалификацию (UPSERT — одна на пользователя)
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error in /api/qualification/submit:', err)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
