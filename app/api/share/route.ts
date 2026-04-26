import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMessage } from '@/lib/telegram-bot'
import { TEXTS } from '@/lib/constants/texts'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { tgId, link: providedLink } = await request.json()

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Missing tgId' }, { status: 400 })
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, tg_id, shared_at')
      .eq('tg_id', tgId)
      .limit(1)

    const profile = profiles?.[0]

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.shared_at) {
      await sendMessage({ chatId: tgId, text: TEXTS.bot.referralLinkPart1 })
      await sendMessage({
        chatId: tgId,
        text: TEXTS.bot.referralLinkPart2(tgId),
      })

      await supabaseAdmin
        .from('profiles')
        .update({ shared_at: new Date().toISOString() } as any)
        .eq('id', profile.id)

      // Enqueue check_referral_12h task
      await supabaseAdmin.from('bot_tasks_queue' as any).insert({
        profile_id: profile.id,
        tg_id: tgId,
        event_type: 'check_referral_12h',
        run_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      })
    } else {
      return NextResponse.json({ success: true, alreadyShared: true })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/share] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
