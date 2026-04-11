import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = 'https://api.telegram.org'

/**
 * POST /api/admin/message/user — send direct message to a specific user
 * Body: { target_tg_id: number, text: string }
 * Protected by X-Admin-Pin header
 */
async function checkAdmin(req: NextRequest): Promise<boolean> {
  const adminPin = req.headers.get('x-admin-pin')
  if (adminPin !== '2026') return false
  return true
}

export async function POST(req: NextRequest) {
  const isAdmin = await checkAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { target_tg_id: number; text: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { target_tg_id, text } = body

  if (!target_tg_id || !text || text.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'target_tg_id and text are required' }, { status: 400 })
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ success: false, error: 'Bot token not configured' }, { status: 500 })
  }

  console.log(`[admin-message] Sending to tg_id=${target_tg_id}`)

  try {
    const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: target_tg_id,
        text: text.trim(),
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[admin-message] Failed (${res.status}):`, errText)
      return NextResponse.json(
        { success: false, error: `Telegram API error: ${errText}` },
        { status: 500 }
      )
    }

    console.log(`[admin-message] Successfully sent to tg_id=${target_tg_id}`)
    return NextResponse.json({ success: true, data: { sent: true } })
  } catch (err) {
    console.error('[admin-message] Unexpected error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
