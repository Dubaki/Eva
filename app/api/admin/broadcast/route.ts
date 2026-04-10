import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = 'https://api.telegram.org'

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const adminPin = req.headers.get('x-admin-pin')
  if (adminPin !== '2026') return false
  return true
}

/**
 * Send text message to a Telegram user
 */
async function sendTextMessage(chatId: number, text: string): Promise<boolean> {
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
      console.error(`[broadcast] sendMessage to ${chatId} failed (${res.status}):`, errText)
      return false
    }
    return true
  } catch (err) {
    console.error(`[broadcast] sendMessage error for ${chatId}:`, err)
    return false
  }
}

/**
 * Send photo with caption to a Telegram user
 */
async function sendPhotoMessage(chatId: number, photoBuffer: Buffer, caption: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const form = new FormData()
    form.append('chat_id', String(chatId))
    const uint8 = new Uint8Array(photoBuffer)
    form.append('photo', new Blob([uint8], { type: 'image/jpeg' }), 'photo.jpg')
    if (caption) {
      form.append('caption', caption)
      form.append('parse_mode', 'HTML')
    }

    const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[broadcast] sendPhoto to ${chatId} failed (${res.status}):`, errText)
      return false
    }
    return true
  } catch (err) {
    console.error(`[broadcast] sendPhoto error for ${chatId}:`, err)
    return false
  }
}

/**
 * POST /api/admin/broadcast — send broadcast to all users
 * Accepts FormData: message (text) + photo (optional file)
 */
export async function POST(req: NextRequest) {
  const isAdmin = await checkAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized. PIN required.' }, { status: 401 })
  }

  // Parse FormData
  let message = ''
  let photoBuffer: Buffer | null = null

  try {
    const formData = await req.formData()
    message = formData.get('message') as string ?? ''
    const photoFile = formData.get('photo') as File | null

    if (photoFile && photoFile.size > 0) {
      const bytes = await photoFile.arrayBuffer()
      photoBuffer = Buffer.from(bytes)
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  if (!message.trim() && !photoBuffer) {
    return NextResponse.json({ success: false, error: 'Message or photo is required' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  // Get all user tg_ids
  const { data: users, error } = await supabase
    .from('profiles')
    .select('tg_id')

  if (error || !users) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
  }

  const totalUsers = users.length
  console.log(`[broadcast] Starting broadcast to ${totalUsers} users (hasPhoto: ${!!photoBuffer})`)

  // Send messages with per-user try/catch — one blocked user won't stop the rest
  let sent = 0
  let failed = 0

  for (const user of users) {
    if (!user.tg_id) {
      failed++
      continue
    }

    try {
      let ok: boolean
      if (photoBuffer) {
        ok = await sendPhotoMessage(user.tg_id, photoBuffer, message)
      } else {
        ok = await sendTextMessage(user.tg_id, message)
      }

      if (ok) sent++
      else failed++

      // Rate limiting: Telegram allows ~30 msg/sec, we use 50ms delay = ~20 msg/sec
      await new Promise((r) => setTimeout(r, 50))
    } catch (err) {
      console.error(`[broadcast] Unexpected error for user ${user.tg_id}:`, err)
      failed++
    }
  }

  console.log(`[broadcast] Complete: ${sent} sent, ${failed} failed out of ${totalUsers}`)

  return NextResponse.json({
    success: true,
    data: { total: totalUsers, sent, failed },
  })
}
