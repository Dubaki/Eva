/**
 * Supabase Edge Function: process-bot-queue
 * Обрабатывает очередь отложенных задач для Telegram бота.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

const headers = {
  'apikey': SUPABASE_KEY!,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  }
  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const err = await res.text()
    console.error(`[Telegram Error] sendMessage to ${chatId}:`, err)
  }
  
  return res.ok
}

serve(async (req: Request) => {
  try {
    console.log(`[bot-queue] Checking for pending tasks at ${new Date().toISOString()}`)

    // 1. Получаем pending задачи, время выполнения которых наступило
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_tasks_queue?status=eq.pending&run_at=lte.${new Date().toISOString()}&order=run_at.asc&limit=50`,
      { method: 'GET', headers }
    )
    
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to fetch tasks: ${err}`)
    }

    const tasks = await res.json()
    console.log(`[bot-queue] Found ${tasks.length} tasks to process.`)
    
    let processed = 0

    for (const task of tasks) {
      try {
        console.log(`[bot-queue] Processing task ${task.id} (type: ${task.event_type}, tg_id: ${task.tg_id})`)

        // 2. Обновляем статус на processing (чтобы другие инстансы не подхватили)
        await fetch(
          `${SUPABASE_URL}/rest/v1/bot_tasks_queue?id=eq.${task.id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'processing', updated_at: new Date().toISOString() })
          }
        )

        // 3. Обрабатываем по типу события
        let success = false

        if (task.event_type === 'start_mini_quiz') {
          const text = '🎯 <b>Мини-квиз:</b>\n\nДавай еще немного пообщаемся? Мне важно узнать чуть больше о твоем запросе.'
          const replyMarkup = {
            inline_keyboard: [[{ text: 'Ответить на вопросы', callback_data: 'quiz_step_1' }]]
          }
          success = await sendTelegramMessage(task.tg_id, text, replyMarkup)

        } else if (task.event_type === 'send_gift') {
          const text = '🎁 <b>Твой подарок готов!</b>\n\nСпасибо за рекомендации. Твоя вторая опора разблокирована.'
          success = await sendTelegramMessage(task.tg_id, text)
        } else {
            console.warn(`[bot-queue] Unknown event type: ${task.event_type}`)
            success = true // Mark as success to remove from queue
        }

        // 4. Обновляем статус на итоговый
        if (success) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/bot_tasks_queue?id=eq.${task.id}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'processed', updated_at: new Date().toISOString() })
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
              error_message: String(err),
              updated_at: new Date().toISOString()
            })
          }
        )
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[bot-queue] Global Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
