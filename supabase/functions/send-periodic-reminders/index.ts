/**
 * Supabase Edge Function: send-periodic-reminders
 *
 * Запускается раз в сутки через pg_cron или HTTP-вызов.
 * Находит пользователей, у которых:
 *   - Последний тест был ровно 60 дней назад
 *   - remind_sent_at IS NULL (не отправляли напоминание)
 *
 * Отправляет сообщение в Telegram с inline-кнопкой "Пройти тест заново".
 * После отправки устанавливает remind_sent_at = NOW().
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN — токен бота
 *   SUPABASE_URL — URL проекта
 *   SUPABASE_SERVICE_ROLE_KEY — сервисный ключ
 *   APP_URL — базовый URL Mini App
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'
const COOLDOWN_DAYS = 60

console.log(`[init] Edge Function: send-periodic-reminders`)
console.log(`[init] BOT_TOKEN configured: ${BOT_TOKEN ? 'yes' : 'no'}`)
console.log(`[init] SUPABASE_URL: ${SUPABASE_URL ?? 'not set'}`)
console.log(`[init] APP_URL: ${APP_URL}`)
console.log(`[init] COOLDOWN_DAYS: ${COOLDOWN_DAYS}`)

// ── Supabase REST API helpers ─────────────────────────────────────────────

async function fetchUsersNeedingReminder(): Promise<Array<{
  profile_id: string
  tg_id: number
  last_test_date: string
}>> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[fetch] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return []
  }

  // Find users whose last test was exactly 60 days ago and haven't been reminded
  // We use the test_results table since that's where the test date is tracked
  // Join with profiles to get tg_id
  const query = `
    SELECT DISTINCT ON (p.id)
      p.id AS profile_id,
      p.tg_id,
      tr.created_at AS last_test_date
    FROM test_results tr
    JOIN profiles p ON tr.profile_id = p.id
    WHERE p.reminded_at IS NULL
      AND tr.created_at <= NOW() - INTERVAL '${COOLDOWN_DAYS} days'
    ORDER BY p.id, tr.created_at DESC
    LIMIT 100
  `

  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`
  
  // Use direct REST query instead (no rpc function needed)
  const directQuery = `${SUPABASE_URL}/rest/v1/profiles?select=id,tg_id,reminded_at&reminded_at=is.null`

  // Fetch all profiles that haven't been reminded
  const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,tg_id,last_test_date,reminded_at&reminded_at=is.null&last_test_date=not.is.null`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!profilesRes.ok) {
    console.error(`[fetch] Failed to fetch profiles (${profilesRes.status}):`, await profilesRes.text())
    return []
  }

  const profiles = await profilesRes.json()
  console.log(`[fetch] Found ${profiles.length} profiles without reminder`)

  // Filter to those whose last_test_date is >= 60 days ago
  const now = new Date()
  const cutoff = new Date(now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

  return profiles
    .filter((p: Record<string, unknown>) => {
      const lastTest = new Date(p.last_test_date as string)
      return lastTest <= cutoff
    })
    .map((p: Record<string, unknown>) => ({
      profile_id: p.id as string,
      tg_id: p.tg_id as number,
      last_test_date: p.last_test_date as string,
    }))
}

async function sendReminder(tgId: number): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('[send] TELEGRAM_BOT_TOKEN not set')
    return false
  }

  const text = `Привет! Прошло уже 2 месяца с твоего последнего теста. Твои опоры могли трансформироваться или укрепиться. Давай проверим твое актуальное состояние?`

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '✨ Пройти тест заново',
          web_app: { url: APP_URL },
        },
      ],
    ],
  }

  console.log(`[send] Sending reminder to tgId=${tgId}`)

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: tgId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[send] Failed to send to tgId=${tgId} (${res.status}):`, errText)
    return false
  }

  console.log(`[send] Reminder sent to tgId=${tgId}`)
  return true
}

async function markAsReminded(profileId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ reminded_at: new Date().toISOString() }),
  })

  if (!res.ok) {
    console.error(`[mark] Failed to mark profile ${profileId} as reminded (${res.status}):`, await res.text())
    return false
  }

  console.log(`[mark] Profile ${profileId} marked as reminded`)
  return true
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (_req: Request) => {
  if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({
      error: 'Missing required env vars: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log('[handler] Starting periodic reminder check')

  const users = await fetchUsersNeedingReminder()
  console.log(`[handler] Found ${users.length} users needing reminder`)

  if (users.length === 0) {
    return new Response(JSON.stringify({ success: true, reminded: 0, message: 'No users need reminder' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let remindedCount = 0
  let failedCount = 0

  for (const user of users) {
    const sent = await sendReminder(user.tg_id)
    if (sent) {
      const marked = await markAsReminded(user.profile_id)
      if (marked) {
        remindedCount++
      } else {
        console.error(`[handler] Failed to mark user ${user.profile_id} as reminded`)
        failedCount++
      }
    } else {
      console.error(`[handler] Failed to send reminder to user ${user.tg_id}`)
      failedCount++
    }
  }

  console.log(`[handler] Complete: ${remindedCount} reminded, ${failedCount} failed out of ${users.length}`)

  return new Response(JSON.stringify({
    success: true,
    reminded: remindedCount,
    failed: failedCount,
    total: users.length,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
