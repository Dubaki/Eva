import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/user/contact-author
 * Marks contact_author_clicked = true for the current user.
 * Called when user clicks "Связь с Автором" on the result page.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawTgId = body.tgId ?? req.headers.get('x-tg-id')
    const tgId = rawTgId ? Number(rawTgId) : null

    if (!tgId) {
      return NextResponse.json(
        { success: false, error: 'Отсутствует tg_id' },
        { status: 401 }
      )
    }

    const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ contact_author_clicked: true })
      .eq('tg_id', tgId)

    if (error) {
      console.error('[contact-author] DB error:', error.message)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact-author] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
