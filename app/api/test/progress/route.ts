import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { searchParams } = new URL(request.url)
    const rawTgId = searchParams.get('tgId') || request.headers.get('x-tg-id')
    const tgId = rawTgId ? Number(rawTgId) : null

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Отсутствует tg_id' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // БРОНЯ: limit(1) вместо single() спасает от ошибки 500 при дубликатах
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('current_step, id')
      .eq('tg_id', tgId)
      .limit(1)

    if (profileError) {
      console.error('[test/progress] Profile fetch error:', profileError.message)
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 })
    }

    const profile = profiles && profiles.length > 0 ? profiles[0] : null

    if (!profile || profile.current_step === null) {
      return NextResponse.json({ success: true, data: null })
    }

    let answers: Record<number, number> | null = null
    
    // БРОНЯ: Тоже убрали maybeSingle на всякий случай
    const { data: testResults } = await supabaseAdmin
      .from('test_results')
      .select('answers')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const testResult = testResults && testResults.length > 0 ? testResults[0] : null

    if (testResult?.answers && typeof testResult.answers === 'object') {
      answers = testResult.answers as unknown as Record<number, number>
    }

    return NextResponse.json({
      success: true,
      data: {
        currentStep: profile.current_step,
        answers,
      },
    })
  } catch (err) {
    console.error('[test/progress] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { step, tgId: bodyTgId } = body

    if (typeof step !== 'number' || step < 0) {
      return NextResponse.json({ success: false, error: 'Некорректный номер шага' }, { status: 400 })
    }

    const rawTgId = bodyTgId || request.headers.get('x-tg-id')
    const tgId = rawTgId ? Number(rawTgId) : null

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Отсутствует tg_id' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Обновляем прогресс (безопасно обновит все дубликаты разом, если они есть)
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ current_step: step })
      .eq('tg_id', tgId)

    if (error) {
      console.error('[test/progress] DB error:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, step })
  } catch (err) {
    console.error('[test/progress] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}