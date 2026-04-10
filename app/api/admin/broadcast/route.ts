import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = 'https://api.telegram.org'

/**
 * POST /api/admin/broadcast — отправить рассылку всем пользователям
 * Требуется PIN 2026 в заголовке X-Admin-Pin
 */

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return false

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false

  // PIN check is mandatory for broadcast
  const adminPin = req.headers.get('x-admin-pin')
  if (adminPin !== '2026') return false

  const token = auth.slice(7)

  // Verify JWT
  const { verifyJwt } = await import('@/lib/jwt')
  const payload = verifyJwt(token, jwtSecret)
  if (!payload) return false

  // Check TESTER_IDS
  const supabase = getSupabaseServer()
  const { data: profile } = await supabase
    .from('profiles')
    .select('tg_id')
    .eq('id', payload.sub)
    .single()

  return !!(profile && TESTER_IDS.includes(String(profile.tg_id)))
}

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false

  try {
    const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[broadcast] Failed to send to ${chatId} (${res.status}):`, errText)
      return false
    }
    return true
  } catch (err) {
    console.error(`[broadcast] Error sending to ${chatId}:`, err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const isAdmin = await checkAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized. PIN required.' }, { status: 401 })
  }

  let body: { message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.message || body.message.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  // Get all user tg_ids
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, tg_id')

  if (error || !users) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
  }

  console.log(`[broadcast] Sending message to ${users.length} users`)

  // Send messages with rate limiting (Telegram limit: ~30 msg/sec)
  const results = await Promise.allSettled(
    users.map(async (user) => {
      if (!user.tg_id) return { success: false, reason: 'no_tg_id' }
      const ok = await sendTelegramMessage(user.tg_id, body.message)
      return { success: ok, tg_id: user.tg_id }
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length
  const failed = results.length - sent

  console.log(`[broadcast] Complete: ${sent} sent, ${failed} failed out of ${users.length}`)

  return NextResponse.json({ success: true, data: { total: users.length, sent, failed } })
}
