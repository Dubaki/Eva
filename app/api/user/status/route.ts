import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getChatMember } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer()
  const url = new URL(req.url)
  const tgIdParam = url.searchParams.get('tg_id')

  if (!tgIdParam) {
    return NextResponse.json({ success: false, error: 'Missing tg_id' }, { status: 400 })
  }

  const numericTgId = Number(tgIdParam)
  if (isNaN(numericTgId)) {
    return NextResponse.json({ success: false, error: 'Invalid tg_id' }, { status: 400 })
  }

  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!channelId) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  // Always verify subscription fresh against Telegram API
  const status = await getChatMember(channelId, numericTgId)
  const isSubscribed = ['member', 'administrator', 'creator'].includes(status ?? '')

  // Update cached value in DB (non-blocking)
  void supabase
    .from('profiles')
    .update({ is_subscribed: isSubscribed } as any)
    .eq('tg_id', numericTgId)

  // Fetch last_test_date
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_test_date')
    .eq('tg_id', numericTgId)
    .maybeSingle()

  const cooldownMs = 60 * 24 * 60 * 60 * 1000
  let cooldownDays = 0
  if (profile?.last_test_date) {
    const elapsed = Date.now() - new Date(profile.last_test_date).getTime()
    if (elapsed < cooldownMs) {
      cooldownDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000))
    }
  }

  return NextResponse.json(
    {
      isSubscribed,
      lastTestDate: profile?.last_test_date ?? null,
      cooldownDays,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}
