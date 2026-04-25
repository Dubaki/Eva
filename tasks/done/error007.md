 ОШИБКА #8: ОТСУТСТВУЕТ ОБРАБОТЧИК bot_tasks_queue В EDGE FUNCTION
Суть ошибки
Таблица bot_tasks_queue вставляет данные (в webhook и в /api/test/submit), но ничто их не обрабатывает!

// Вставляется:
await supabase.from('bot_tasks_queue').insert({
  tg_id: tgId,
  event_type: 'send_gift',
  run_at: new Date(Date.now() + 60000).toISOString(),
  status: 'pending'
})

// Но кто читает эту таблицу? ← НИКТО!

Промт для исправления
Создать или обновить Edge Function (как в документе ЧЕКЛИСТ):

// supabase/functions/process-bot-queue/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function sendTelegramMessage(chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  })
  return res.ok
}

serve(async (req: Request) => {
  try {
    // 1. Получаем pending задачи
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_tasks_queue?status=eq.pending&run_at=lte.${new Date().toISOString()}&order=run_at.asc&limit=100`,
      { method: 'GET', headers }
    )
    
    const tasks = await res.json()
    let processed = 0

    for (const task of tasks) {
      try {
        // 2. Обновляем статус на processing
        await fetch(
          `${SUPABASE_URL}/rest/v1/bot_tasks_queue?id=eq.${task.id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'processing' })
          }
        )

        // 3. Обрабатываем по типу события
        let success = false

        if (task.event_type === 'start_mini_quiz') {
          const text = '🎯 Мини-квиз:\n\nПомогите мне больше узнать о вас...'
          success = await sendTelegramMessage(task.tg_id, text)

        } else if (task.event_type === 'send_gift') {
          const text = '🎁 Спасибо за участие! Вот ваш подарок...'
          success = await sendTelegramMessage(task.tg_id, text)
        }

        // 4. Обновляем статус
        if (success) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/bot_tasks_queue?id=eq.${task.id}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'processed' })
            }
          )
          processed++
        } else {
          throw new Error('Telegram send failed')
        }

      } catch (err) {
        console.error(`[bot-queue] Task ${task.id} failed:`, err)
        await fetch(
          `${SUPABASE_URL}/rest/v1/bot_tasks_queue?id=eq.${task.id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ 
              status: 'failed',
              error_message: String(err)
            })
          }
        )
      }
    }

    return new Response(JSON.stringify({ processed }), { status: 200 })
  } catch (err) {
    console.error('[bot-queue] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

Настроить pg_cron (если доступна):

-- supabase/migrations/105_setup_bot_queue_cron.sql

SELECT cron.schedule('process-bot-queue', '*/1 * * * *', $$
  SELECT net.http_post(
    url := 'https://[YOUR_SUPABASE_URL]/functions/v1/process-bot-queue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  ) as request_id;
$$);

Или использовать External Scheduler:

# На https://www.easycron.com/ или https://cron-job.org/
# Каждую минуту отправлять POST на:
# https://your-vercel-app.com/api/cron/process-bot-queue?secret=YOUR_SECRET

