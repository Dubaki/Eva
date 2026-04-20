/**
 * Supabase Edge Function: process-bot-notifications
 *
 * Поддерживает режимы:
 * 1. Database Webhook (profiles/test_results)
 * 2. Direct API call (action: process_queue)
 * 3. Telegram Webhook (message, callback_query)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const AUTHOR_USERNAME = 'evapatrakhina'

// Константы контента
const GIFT_VIDEO_FILE_ID = 'BAACAgIAAxkBAAIFV2Ym2X8...' // Будет обновлено через дебаг-инструмент

// Картинки опор
const TRAIT_IMAGES: Record<string, string> = {
  S: `${APP_URL}/hero.png`,
  U: `${APP_URL}/pleaser.png`,
  P: `${APP_URL}/perfectionist.png`,
  R: `${APP_URL}/stayer.png`,
  K: `${APP_URL}/controller.png`,
}

const DOMINANT_TRAIT_TEXTS: Record<string, string> = {
  S: `<b>1. ГЕРОИЧЕСКАЯ</b>\nТы та, кто держит. Даже когда тяжело. Даже когда уже нет сил. Ты не позволяешь себе развалиться. Не просишь помощи. Собираешься и идёшь дальше.\n\nНо внутри:\n— постоянное напряжение\n— одиночество\n— ощущение, что всё на тебе\n\nТы привыкла быть сильной. Настолько, что уже не знаешь, как по-другому.\n\nЦена:\nТы живёшь на износе. И даже не разрешаешь себе это признать.\n\n⚡️ Внутри звучит:\n«Если я перестану держать — меня не станет»`,
  U: `<b>2. ПОДСТРАИВАЮЩАЯСЯ</b>\nТы умеешь быть удобной. Чувствовать других. Подстраиваться. Ты сглаживаешь углы. Избегаешь конфликтов. Часто выбираешь не себя.\n\nНо внутри:\n— подавленные желания\n— злость, которую нельзя проявить\n— страх быть отвергнутой\n\nТы стараешься быть хорошей. Но это не даёт тебе того, что ты хочешь.\n\nЦена:\nТы теряешь себя, чтобы сохранить отношения.\n\n⚡️ Внутри звучит:\n«Если я буду собой — меня не выберут»`,
  P: `<b>3. ПЕРФЕКЦИОНИРУЮЩАЯ</b>\nТы живёшь через результат. Через «сделать правильно» Ты стараешься быть идеальной. Не ошибаться. Держать уровень.\n\nНо внутри:\n— страх критики\n— напряжение\n— ощущение, что ты недостаточно хороша\n\nТы всё время доказываешь свою ценность. Даже когда уже доказала.\n\nЦена:\nТы не можешь расслабиться. Потому что всегда есть «ещё лучше».\n\n⚡️ Внутри звучит:\n«Если я не идеальна — я ничто»`,
  R: `<b>4. УДЕРЖИВАЮЩАЯ</b>\nТы чувствуешь всё. Атмосферу, людей, напряжение. Ты сглаживаешь конфликты. Поддерживаешь. Держишь «поле».\n\nНо внутри:\n— перегруз\n— тревожность\n— ощущение, что слишком много на тебе\n\nТы живёшь через других. И почти не остаётся места для себя.\n\nЦена:\nТы выгораешь, удерживая то, что не обязана держать.\n\n⚡️ Внутри звучит:\n«Если я отпущу — всё развалится»`,
  K: `<b>5. КОНТРОЛИРУЮЩАЯ</b>\nТы стараешься всё предусмотреть. Держать под контролем. Ты анализируешь, планируешь, просчитываешь. Не любишь неопределённость.\n\nНо внутри:\n— тревога\n— напряжение\n— ощущение угрозы\n\nТы не расслабляешься. Потому что «вдруг что-то пойдёт не так».\n\nЦена:\nТы живёшь в постоянной готовности к опасности.\n\n⚡️ Внутри звучит:\n«Если я не контролирую — я в опасности»`,
}

// ── Telegram API helpers ────────────────────────────────────────────

async function api(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[TG API] ${method} failed:`, err)
    return false
  }
  return true
}

async function sendPhoto(chatId: number, photo: string, caption?: string, replyMarkup?: any) {
  return api('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML', reply_markup: replyMarkup })
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  return api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup })
}

async function sendVideo(chatId: number, video: string, caption?: string, protectContent = false) {
  return api('sendVideo', { chat_id: chatId, video, caption, protect_content: protectContent, parse_mode: 'HTML' })
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return api('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

// ── Database helpers ────────────────────────────────────────────────

async function db(path: string, method = 'GET', body?: any) {
  const options: any = {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }
  if (method !== 'GET') {
    options.method = method
    options.body = JSON.stringify(body)
  }
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, options)
  const text = await res.text()
  
  if (!res.ok) {
    console.error(`[DB] ${method} ${path} failed:`, text)
    throw new Error(`DB request failed: ${text}`)
  }
  
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ── Logic ───────────────────────────────────────────────────────────

async function handleProcessQueue() {
  const now = new Date().toISOString()
  console.log(`[queue] Checking bot_tasks_queue. Server time: ${now}`)

  let tasks: any[] = []
  try {
    // Детальный лог для проверки фильтров
    console.log(`[queue] Querying: bot_tasks_queue?status=eq.pending&run_at=lte.${now}`)
    tasks = await db(`bot_tasks_queue?status=eq.pending&run_at=lte.${now}`)
  } catch (err) {
    console.error('[queue] Failed to fetch tasks:', err)
    return
  }

  console.log(`[queue] Tasks found in DB: ${tasks?.length || 0}`)

  if (!tasks || tasks.length === 0) {
    // Логируем причину пустого списка (для отладки времени)
    try {
      const nextTasks = await db('bot_tasks_queue?status=eq.pending&order=run_at.asc&limit=1')
      if (nextTasks && nextTasks.length > 0) {
        console.log(`[queue] Next pending task is scheduled at: ${nextTasks[0].run_at}. Still waiting...`)
      } else {
        console.log('[queue] No pending tasks at all in DB.')
      }
    } catch { /* ignore debug log failure */ }
    return
  }

  for (const task of tasks) {
    console.log(`[queue] Task ${task.id} (type: ${task.event_type}, tg: ${task.tg_id})`)
    try {
      if (task.event_type === 'start_mini_quiz') {
        // Message 1
        await sendMessage(task.tg_id, 'Давай еще немного пообщаемся... Мы же только начали.')
        await new Promise(r => setTimeout(r, 2000))
        
        // Message 2 + Question 1
        const text2 = `Ты сейчас увидела механизм. И, скорее всего, это не первый раз, когда ты что-то про себя понимаешь. Вопрос в другом: почему это до сих пор не меняет твою жизнь? Потому что понимание не демонтирует паттерн. Это делается только через работу.`
        const markup = {
          inline_keyboard: [
            [{ text: 'Деньги', callback_data: 'quiz_q1_money' }],
            [{ text: 'Отношения', callback_data: 'quiz_q1_relations' }],
            [{ text: 'Здоровье', callback_data: 'quiz_q1_health' }],
            [{ text: 'Другое', callback_data: 'quiz_q1_other' }]
          ]
        }
        await sendMessage(task.tg_id, text2 + '\n\n<b>В какой сфере ты сейчас сильнее всего чувствуешь напряжение?</b>', markup)
        
        // Update user step in profile
        await db(`profiles?tg_id=eq.${task.tg_id}`, 'PATCH', { bot_quiz_step: 1 })
      } 
      
      else if (task.event_type === 'send_gift') {
        await sendMessage(task.tg_id, '♡ Благодарю тебя за честность!\n\nЧестность — это то, на чем строятся все мои методы работы. Чтобы тест не остался просто тестом, я дарю тебе практику по твоей напряжённой сфере.')
        // Protect content for video gift
        await sendVideo(task.tg_id, GIFT_VIDEO_FILE_ID, 'Твой подарок от Евы Патрахиной. Посмотри его внимательно.', true)
      }

      // Mark task as completed
      await db(`bot_tasks_queue?id=eq.${task.id}`, 'PATCH', { status: 'completed' })
      console.log(`[queue] Task ${task.id} completed.`)
    } catch (err) {
      console.error(`[queue] Task ${task.id} failed processing:`, err)
    }
  }
}

async function handleTelegramWebhook(update: any) {
  // 1. Debug: Get file_id from author
  if (update.message?.video && update.message.from?.username === AUTHOR_USERNAME) {
    const fileId = update.message.video.file_id
    await sendMessage(update.message.chat.id, `<code>${fileId}</code>\n\nСкопируй этот ID и вставь в константу GIFT_VIDEO_FILE_ID в Edge Function.`)
    return
  }

  // 2. Callback Queries
  if (update.callback_query) {
    const cb = update.callback_query
    const tgId = cb.from.id
    const data = cb.data
    await answerCallbackQuery(cb.id)

    console.log(`[webhook] Callback: ${data} from ${tgId}`)

    // Get user profile to determine current step
    let profile: any = null
    try {
      const profiles = await db(`profiles?tg_id=eq.${tgId}`)
      if (profiles && profiles.length > 0) {
        profile = profiles[0]
      }
    } catch (err) {
      console.error('[webhook] Failed to fetch profile:', err)
      return
    }

    if (!profile) {
      console.error(`[webhook] Profile not found for tg_id ${tgId}`)
      return
    }

    // Step 1 -> Step 2
    if (data.startsWith('quiz_q1_')) {
      const sphere = data.replace('quiz_q1_', '')
      // Post qualification (upsert via RPC or direct POST)
      // Using direct POST to qualifications. If it fails due to PK, we might need a different approach
      // but usually profile_id is not PK, 'id' is.
      try {
        await db('qualifications', 'POST', { profile_id: profile.id, tension_sphere: sphere })
      } catch {
        // If POST fails (e.g. record exists), try PATCH
        await db(`qualifications?profile_id=eq.${profile.id}`, 'PATCH', { tension_sphere: sphere })
      }
      
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 2 })
      
      const markup = {
        inline_keyboard: [
          [{ text: 'Сильно мешает', callback_data: 'quiz_q2_hard' }],
          [{ text: 'Пока терпимо', callback_data: 'quiz_q2_medium' }],
          [{ text: 'Фоново', callback_data: 'quiz_q2_light' }]
        ]
      }
      await sendMessage(tgId, '<b>Насколько это ощущается остро?</b>', markup)
    }

    // Step 2 -> Step 3
    else if (data.startsWith('quiz_q2_')) {
      const level = data.replace('quiz_q2_', '')
      await db(`qualifications?profile_id=eq.${profile.id}`, 'PATCH', { tension_level: level })
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 3 })
      
      const markup = {
        inline_keyboard: [
          [{ text: 'Да, многое', callback_data: 'quiz_q3_yes' }],
          [{ text: 'Немного', callback_data: 'quiz_q3_some' }],
          [{ text: 'Нет', callback_data: 'quiz_q3_no' }]
        ]
      }
      await sendMessage(tgId, '<b>Ты уже пробовала что-то с этим делать?</b>', markup)
    }

    // Step 3 -> Final Offer
    else if (data.startsWith('quiz_q3_')) {
      const attempts = data.replace('quiz_q3_', '')
      await db(`qualifications?profile_id=eq.${profile.id}`, 'PATCH', { previous_attempts: attempts })
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 4 })
      
      const text = `Есть 2 способа работы с искаженной опорой:\n\n✓ Жёсткий, но быстрый — это группа «Пробой»\n✓ Мягкий и постепенный — это «Пирамида Потенциала» или персональная работа\n\nКакой способ тебе ближе?`
      const markup = {
        inline_keyboard: [
          [{ text: 'Жесткий быстрый', callback_data: 'quiz_final_hard' }],
          [{ text: 'Мягкий постепенный', callback_data: 'quiz_final_soft' }],
          [{ text: 'Пока не готова', callback_data: 'quiz_final_not_ready' }]
        ]
      }
      await sendMessage(tgId, text, markup)
    }

    // Final Offer Choice
    else if (data.startsWith('quiz_final_')) {
      const choice = data.replace('quiz_final_', '')
      const msg = choice === 'hard' ? 'Выбрала Пробой' : choice === 'soft' ? 'Выбрала Пирамиду' : 'Пока не готова'
      
      // Schedule gift task (60 seconds delay)
      await db('bot_tasks_queue', 'POST', {
        profile_id: profile.id,
        tg_id: tgId,
        event_type: 'send_gift',
        run_at: new Date(Date.now() + 60000).toISOString(),
        status: 'pending'
      })

      const authorLink = `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent('Привет! Я прошла тест. ' + msg)}`
      await sendMessage(tgId, `Записала! Переходи в диалог со мной, чтобы обсудить детали:\n\n👉 <a href="${authorLink}">Написать Еве</a>`)
      
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 5 })
    }
  }
}

// ── Main Handler ─────────────────────────────────────────────────────

serve(async (req: Request) => {
  try {
    const payload = await req.json()
    const action = payload.action || (payload.update_id ? 'telegram_webhook' : (payload.table ? 'db_webhook' : 'unknown'))
    console.log(`[req] Action received: ${action}`)
    console.log('[req] Payload received:', JSON.stringify(payload))

    // 1. Process Queue (Cron or Manual trigger)
    if (payload.action === 'process_queue') {
      await handleProcessQueue()
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      })
    }

    // 2. Telegram Webhook (via Next.js forwarding)
    if (payload.update_id || payload.callback_query || payload.message) {
      await handleTelegramWebhook(payload)
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      })
    }

    // 3. Database Webhook (Existing result delivery logic)
    if (payload.table === 'test_results' && payload.type === 'INSERT') {
      const record = payload.record
      const profileId = record.profile_id
      const dominantTrait = record.dominant_trait

      const profiles = await db(`profiles?id=eq.${profileId}&select=tg_id`)
      if (profiles && profiles.length > 0 && dominantTrait) {
        const tgId = profiles[0].tg_id
        const traitKey = dominantTrait.toUpperCase()
        const imageUrl = TRAIT_IMAGES[traitKey] || TRAIT_IMAGES['S']
        const text = DOMINANT_TRAIT_TEXTS[traitKey] || `Ваша опора: ${traitKey}`
        
        console.log(`[db-webhook] Sending result to ${tgId}`)
        await sendPhoto(tgId, imageUrl, text)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true, ignored: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[error] Handler crashed:', err)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
