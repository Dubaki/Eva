import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tgId = body.tgId

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Не передан tgId' }, { status: 400 })
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Ищем профиль
    let { data: profile } = await supabaseAdmin.from('profiles').select('id, tg_id').eq('tg_id', tgId).single()

    // 2. Если профиля нет — создаем его прямо сейчас
    if (!profile) {
      const { data: newProfile } = await supabaseAdmin.from('profiles')
        .insert([{ tg_id: tgId, is_subscribed: true }])
        .select('id, tg_id').single()
      profile = newProfile
    }

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Ошибка БД' }, { status: 500 })
    }

    // 3. Обновляем статус подписки (если он вдруг был false)
    await supabaseAdmin.from('profiles').update({ is_subscribed: true }).eq('tg_id', tgId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}