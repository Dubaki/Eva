import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/contact-author
 * Marks contact_author_clicked = true for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const { tgId } = await request.json()

    if (!tgId) {
      return NextResponse.json(
        { success: false, error: 'Missing tgId' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update the flag in profiles
    const { error } = await supabase
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
