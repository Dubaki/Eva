/**
 * Supabase Edge Function: send-periodic-reminders
 *
 * Находит пользователей, у которых:
 *   - Последний тест был 60+ дней назад
 *   - reminded_at IS NULL (напоминание еще не отправлялось в текущем цикле)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Формируем APP_URL и логируем его для отладки
let APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'
if (!APP_URL.startsWith('http')) {
  APP_URL = `https://${APP_URL}`
}

const COOLDOWN_DAYS = 60

console.log(`[init] Periodic reminders function started.`)
console.log(`[DEBUG] Кнопка "Пройти тест заново" будет вести на URL: ${APP_URL}`)

async function fetchUsers(): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,tg_id,last_test_date,reminded_at&reminded_at=is.null&last_test_date=not.is.null`, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[fetch] Error fetching profiles: ${text}`)
    return []
  }

  const profiles = await res.json()
  console.log(`[fetch] Found ${profiles.length} candidates with reminded_at=NULL`)

  const now = new Date()
  const cutoff = new Date(now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

  return profiles.filter((p: any) => {
    const lastTest = new Date(p.last_test_date)
    const isReady = lastTest <= cutoff
    if (isReady) {
      console.log(`[filter] User ${p.tg_id} is READY. Last test: ${p.last_test_date}`)
    }
    return isReady
  })
}

async function sendReminder(tgId: number): Promise<boolean> {
  const text = `Привет! Прошло уже 2 месяца с твоего последнего теста. Твои опоры могли трансформироваться или укрепиться. Давай проверим твое актуальное состояние?`
  const replyMarkup = {
    inline_keyboard: [[{ text: '✨ Пройти тест заново', web_app: { url: APP_URL } }]],
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tgId, text, parse_mode: 'HTML', reply_markup: replyMarkup }),
  })

  return res.ok
}

async function markAsReminded(profileId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ reminded_at: new Date().toISOString() }),
  })
}

serve(async () => {
  try {
    const users = await fetchUsers()
    console.log(`[handler] Total users to remind: ${users.length}`)

    for (const user of users) {
      console.log(`[handler] Processing user ${user.tg_id}...`)
      const ok = await sendReminder(user.tg_id)
      if (ok) {
        await markAsReminded(user.id)
        console.log(`[handler] User ${user.tg_id} reminded and marked.`)
      } else {
        console.error(`[handler] Failed to send to ${user.tg_id}`)
      }
    }

    return new Response(JSON.stringify({ success: true, processed: users.length }), { status: 200 })
  } catch (err) {
    console.error(`[critical] ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
