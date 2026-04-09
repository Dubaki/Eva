import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ success: false, error: 'Bot token not configured' }, { status: 500 })
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 401 })
  }

  const token = auth.slice(7)
  const payload = verifyJwt(token, jwtSecret)
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  const supabase = getSupabaseServer()

  // Get user's test results
  const { data: testResult } = await supabase
    .from('test_results')
    .select('dominant_trait, secondary_trait')
    .eq('profile_id', payload.sub)
    .single()

  if (!testResult?.dominant_trait || !testResult?.secondary_trait) {
    return NextResponse.json({ success: false, error: 'No test results found' }, { status: 404 })
  }

  // Get user's tg_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('tg_id')
    .eq('id', payload.sub)
    .single()

  if (!profile?.tg_id) {
    return NextResponse.json({ success: false, error: 'No Telegram chat ID' }, { status: 404 })
  }

  // Build mixed trait key (sorted alphabetically)
  const traits = [testResult.dominant_trait.toUpperCase(), testResult.secondary_trait.toUpperCase()].sort()
  const key = traits.join('')
  const mixedText = MIXED_TRAIT_TEXTS[key]

  if (!mixedText) {
    return NextResponse.json({ success: false, error: `Unknown mixed trait key: ${key}` }, { status: 404 })
  }

  // Send to user's Telegram
  try {
    const notificationText =
      `🎉 <b>Твой второй уровень открыт!</b>\n\nПришло время узнать твою теневую опору:\n\n${mixedText.replace(/\n/g, '\n')}`

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: profile.tg_id,
        text: notificationText,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[debug-mixed-trait] Telegram API error:', err)
      return NextResponse.json({ success: false, error: 'Telegram API error' }, { status: 502 })
    }

    console.log(`[debug-mixed-trait] Sent mixed trait ${key} to user tg_id=${profile.tg_id}`)
    return NextResponse.json({ success: true, mixedTraitKey: key })
  } catch (err) {
    console.error('[debug-mixed-trait] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
