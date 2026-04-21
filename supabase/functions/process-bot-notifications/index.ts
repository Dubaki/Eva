/**
 * Supabase Edge Function: process-bot-notifications
 *
 * Поддерживает режимы:
 * 1. Database Webhook (profiles/test_results)
 * 2. Direct API call (action: process_queue / event: referrals_reached_2)
 * 3. Telegram Webhook (message, callback_query)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const AUTHOR_USERNAME = 'evapatrakhina'

// Константы контента
const GIFT_VIDEO_FILE_ID = 'BAACAgIAAxkBAAIDNGnm9VTZm2GzCHI0zF8AAc_Ebaa17QACXpkAAseAOEse8WaqrIdLSDsE'

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

const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU: `S + U — «Тихий тащитель»\n\nТы тащишь.\nИ делаешь это тихо.\nТы справляешься.\nНе просишь помощи.\nИ при этом стараешься быть удобной.\n\nНо внутри:\n— усталость\n— одиночество\n— ощущение, что тебя не видят\n\nТы отдаёшь много.\nНо это не возвращается.\n\nЦена:\nТы исчезаешь из своей же жизни.\n\n⚡️ Внутри звучит:\n«Я всё делаю правильно… почему меня не выбирают?»`,
  SP: `S + P — «Машина результата»\n\nТы работаешь на максимум.\nСильная. Эффективная. Идеальная.\nТы не позволяешь себе слабость.\nИ не позволяешь ошибаться.\n\nНо внутри:\n— выгорание\n— пустота\n— отрезанность от себя\n\nТы как система.\nНо не как живая.\n\nЦена:\nТы теряешь себя ради результата.\n\n⚡️ Внутри звучит:\n«Я должна быть сверхчеловеком»`,
  RS: `S + R — «Опора для всех»\n\nТы держишь не только себя — ты држишь всех.\nТы чувствуешь других.\nРегулируешь. Поддерживаешь.\n\nНо внутри:\n— перегруз\n— усталость\n— ощущение «слишком много на мне»\n\nТы несёшь больше, чем можешь.\n\nЦена:\nТы живёшь чужими жизнями вместо своей.\n\n⚡️ Внутри звучит:\n«Без меня всё развалится»`,
  KS: `S + K — «Железная система»\n\nТы сильная и всё контролируешь.\nТы держишь. Просчитываешь.\nНе даёшь себе расслабиться.\n\nНо внутри:\n— жёсткость\n— тревога\n— напряжение\n\nТы как будто всегда «на посту».\n\nЦена:\nТы не живёшь — ты управляешь выживанием.\n\n⚡️ Внутри звучит:\n«Я должна удержать всё любой ценой»`,
  PU: `U + P — «Идеальная для всех»\n\nТы стараешься быть идеальной, чтобы тебя любили.\nТы подстраиваешься.\nСоответствуешь. Стараешься.\n\nНо внутри:\n— стыд\n— страх «недостаточности»\n— зависимость от оценки\n\nТы не можешь быть собой.\n\nЦена:\nТы живёшь чужими ожиданиями.\n\n⚡️ Внутри звучит:\n«Если я не идеальна — меня не выберут»`,
  RU: `U + R — «Спасатель»\n\nТы живёшь через помощь другим.\nТы включаешься.\nСпасаешь. Поддерживаешь.\n\nНо внутри:\n— истощение\n— пустота\n— ощущение, что тебя нет\n\nТы отдаёшь себя, чтобы быть нужной.\n\nЦена:\nТы теряешь контакт с собой.\n\n⚡️ Внутри звучит:\n«Я нужна, только если я полезна»`,
  KU: `U + K — «Тревожный угодник»\n\nТы стараешься угадать, как правильно.\nТы анализируешь реакции.\nПодстраиваешься. Контролируешь.\n\nНо внутри:\n— тревога\n— напряжение\n— страх ошибиться\n\nТы живёшь в режиме «не так сделать нельзя».\n\nЦена:\nТы теряешь свободу и спонтанность.\n\n⚡️ Внутри звучит:\n«Если я ошибусь — меня отвергнут»`,
  PR: `P + R — «Социальный идеал»\n\nТы пытаешься быть идеальной для всех.\nТы чувствуешь ожидания.\nИ стараешься им соответствовать.\n\nНо внутри:\n— перегруз\n— потеря себя\n— тревога\n\nТы разрываешься между «как надо».\n\nЦена:\nТы не знаешь, какая ты настоящая.\n\n⚡️ Внутри звучит:\n«Я должна соответствовать всем»`,
  KP: `P + K — «Тревожный достигатор»\n\nТы живёшь через контроль и идеальность.\nТы стараешься предусмотреть всё.\nНе ошибаться. Быть на высоте.\n\nНо внутри:\n— напряжение\n— тревога\n— страх провала\n\nТы не можешь выдохнуть.\n\nЦена:\nТы живёшь в постоянном напряжении «а вдруг что-то не так».\n\n⚡️ Внутри звучит:\n«Ошибка — это катастрофа»`,
  KR: `R + K — «Сканер угроз»\n\nТы постоянно на чеку.\nТы чувствуешь всё.\nИ пытаешься предотвратить плохое.\n\nНо внутри:\n— перегруз\n— тревога\n— усталость\n\nТы не расслабляешься вообще.\n\nЦена:\nТы живёшь в режиме постоянной опасности.\n\n⚡️ Внутри звучит:\n«Я должна всё предусмотреть, иначе будет плохо»`,
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
    tasks = await db(`bot_tasks_queue?status=eq.pending&run_at=lte.${now}`)
  } catch (err) {
    console.error('[queue] Failed to fetch tasks:', err)
    return
  }

  if (!tasks || tasks.length === 0) return

  for (const task of tasks) {
    try {
      if (task.event_type === 'start_mini_quiz') {
        await sendMessage(task.tg_id, 'Ты уже заметила, как искаженная опора влияет на твою жизнь?\n\nДавай еще немного пообщаемся! Ответь на три простых вопроса и получи подарок')
        await new Promise(r => setTimeout(r, 2000))
        await sendMessage(task.tg_id, 'Ты сейчас увидела механизм. И, скорее всего, это не первый раз, когда ты что-то про себя понимаешь.\n\nВопрос в другом: почему это до сих пор не меняет твою жизнь?\n\nПотому что понимание не демонтирует паттерн. Это делается только через работу.')
        await new Promise(r => setTimeout(r, 1500))

        const markupQ1 = {
          inline_keyboard: [
            [{ text: 'Деньги', callback_data: 'quiz_q1_money' }],
            [{ text: 'Отношения', callback_data: 'quiz_q1_relations' }],
            [{ text: 'Здоровье', callback_data: 'quiz_q1_health' }],
            [{ text: 'Другое', callback_data: 'quiz_q1_other' }],
            [{ text: 'Везде', callback_data: 'quiz_q1_all' }],
          ]
        }
        await sendMessage(task.tg_id, '<b>В какой сфере ты сейчас сильнее всего чувствуешь напряжение?</b>', markupQ1)
        await db(`profiles?tg_id=eq.${task.tg_id}`, 'PATCH', { bot_quiz_step: 1 })
      } else if (task.event_type === 'send_gift') {
        const giftText = 'Благодарю тебя за честность! Честность — это то, на чем строятся все мои методы работы. Чтобы тест не остался просто тестом, я дарю тебе практику нейроманифестации. Ты можешь начать изменения уже сегодня.'
        await sendMessage(task.tg_id, giftText)
        await new Promise(r => setTimeout(r, 1000))
        await sendVideo(task.tg_id, GIFT_VIDEO_FILE_ID, undefined, true)
      }
      await db(`bot_tasks_queue?id=eq.${task.id}`, 'PATCH', { status: 'completed' })
    } catch (err) {
      console.error(`[queue] Task ${task.id} failed:`, err)
    }
  }
}

async function handleTelegramWebhook(update: any) {
  if (update.message?.video && update.message.from?.username === AUTHOR_USERNAME) {
    const fileId = update.message.video.file_id
    await sendMessage(update.message.chat.id, `<code>${fileId}</code>`)
    return
  }

  if (update.callback_query) {
    const cb = update.callback_query
    const tgId = cb.from.id
    const data = cb.data
    await answerCallbackQuery(cb.id)

    let profile: any = null
    try {
      const profiles = await db(`profiles?tg_id=eq.${tgId}`)
      if (profiles && profiles.length > 0) profile = profiles[0]
    } catch { return }

    if (!profile) return

    if (data.startsWith('quiz_q1_')) {
      const sphere = data.replace('quiz_q1_', '')
      try { await db('qualifications', 'POST', { profile_id: profile.id, tension_sphere: sphere }) } catch {
        await db(`qualifications?profile_id=eq.${profile.id}`, 'PATCH', { tension_sphere: sphere })
      }
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 2 })
      const markup = {
        inline_keyboard: [[{ text: 'Сильно мешает', callback_data: 'quiz_q2_hard' }], [{ text: 'Пока терпимо', callback_data: 'quiz_q2_medium' }], [{ text: 'Фоново', callback_data: 'quiz_q2_light' }]]
      }
      await sendMessage(tgId, '<b>Насколько это ощущается остро?</b>', markup)
    } else if (data.startsWith('quiz_q2_')) {
      const level = data.replace('quiz_q2_', '')
      await db(`qualifications?profile_id=eq.${profile.id}`, 'PATCH', { tension_level: level })
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 3 })
      const markup = {
        inline_keyboard: [[{ text: 'Да, многое', callback_data: 'quiz_q3_yes' }], [{ text: 'Немного', callback_data: 'quiz_q3_some' }], [{ text: 'Нет', callback_data: 'quiz_q3_no' }]]
      }
      await sendMessage(tgId, '<b>Ты уже пробовала что-то с этим делать?</b>', markup)
    } else if (data.startsWith('quiz_q3_')) {
      const attempts = data.replace('quiz_q3_', '')
      await db(`qualifications?profile_id=eq.${profile.id}`, 'PATCH', { previous_attempts: attempts })
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 4 })
      const text = 'Есть 2 способа работы с искаженной опорой:\n\n✓ Жёсткий, но быстрый — это группа "Пробой"\n\n✓ Мягкий и постепенный — это "Пирамида Потенциала" или персональная работа\n\nКакой способ тебе ближе?'
      const markup = {
        inline_keyboard: [[{ text: 'Жесткий быстрый', callback_data: 'quiz_final_hard' }], [{ text: 'Мягкий постепенный', callback_data: 'quiz_final_soft' }], [{ text: 'Пока не готова', callback_data: 'quiz_final_not_ready' }]]
      }
      await sendMessage(tgId, text, markup)
    } else if (data === 'quiz_final_hard' || data === 'quiz_final_soft') {
      const prefilledText = data === 'quiz_final_hard' ? 'Пробой!' : 'Пирамида Потенциала'
      const authorUrl = `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent(prefilledText)}`
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 5 })
      await db('bot_tasks_queue', 'POST', {
        profile_id: profile.id, tg_id: tgId, event_type: 'send_gift', run_at: new Date(Date.now() + 60000).toISOString(), status: 'pending'
      })
      const markup = { inline_keyboard: [[{ text: 'Написать Еве', url: authorUrl }]] }
      await sendMessage(tgId, 'Отлично! Нажми кнопку ниже — я жду твоего сообщения:', markup)
    } else if (data === 'quiz_final_not_ready') {
      await db(`profiles?tg_id=eq.${tgId}`, 'PATCH', { bot_quiz_step: 5 })
      const giftText = 'Благодарю тебя за честность! Честность — это то, на чем строятся все мои методы работы. Чтобы тест не остался просто тестом, я дарю тебе практику нейроманифестации. Ты можешь начать изменения уже сегодня.'
      const giftMarkup = { inline_keyboard: [[{ text: 'Забрать подарок', callback_data: 'get_gift' }]] }
      await sendMessage(tgId, giftText, giftMarkup)
    } else if (data === 'get_gift') {
      await sendVideo(tgId, GIFT_VIDEO_FILE_ID, undefined, true)
    }
  }
}

// ── Main Handler ─────────────────────────────────────────────────────

serve(async (req: Request) => {
  try {
    const payload = await req.json()
    
    // 1. Direct Milestone Event
    if (payload.event === 'referrals_reached_2') {
      const text = MIXED_TRAIT_TEXTS[payload.mixed_trait]
      if (text) {
        await sendMessage(payload.tg_id, `<b>🎉 Поздравляем! По твоей ссылке 2 человека прошли тест.</b>\n\nТебе открылась твоя «Вторая опора»:\n\n${text}`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // 2. Process Queue (Cron or Manual trigger)
    if (payload.action === 'process_queue') {
      await handleProcessQueue()
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    // 3. Telegram Webhook (via Next.js forwarding)
    if (payload.update_id || payload.callback_query || payload.message) {
      await handleTelegramWebhook(payload)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    // 4. Database Webhook — test_results INSERT → отправка результата опоры
    if (payload.table === 'test_results' && payload.type === 'INSERT') {
      const record = payload.record
      const profiles = await db(`profiles?id=eq.${record.profile_id}&select=tg_id`)
      if (profiles && profiles.length > 0 && record.dominant_trait) {
        const tgId = profiles[0].tg_id
        const traitKey = record.dominant_trait.toUpperCase()
        await sendPhoto(tgId, TRAIT_IMAGES[traitKey] || TRAIT_IMAGES['S'], DOMINANT_TRAIT_TEXTS[traitKey] || `Ваша опора: ${traitKey}`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (payload.table === 'profiles' && payload.type === 'UPDATE') {
      const record = payload.record
      const oldRecord = payload.old_record
      
      // Срабатывает, если счетчик стал равен 2 (и раньше не был равен 2)
      if (record.invites_count === 2 && oldRecord?.invites_count !== 2) {
        // Ищем результаты теста для этого пользователя
        const results = await db(`test_results?profile_id=eq.${record.id}&select=dominant_trait,secondary_trait`)
        const tr = results?.[0]
        
        if (tr?.dominant_trait && tr?.secondary_trait) {
          const mixedKey = [tr.dominant_trait.toUpperCase(), tr.secondary_trait.toUpperCase()].sort().join('')
          const mixedText = MIXED_TRAIT_TEXTS[mixedKey]
          
          if (mixedText) {
            await sendMessage(record.tg_id, `<b>🎉 Поздравляем! По твоей ссылке 2 человека прошли тест.</b>\n\nТебе открылась твоя «Вторая опора»:\n\n${mixedText}`)
            console.log(`[ref-bonus] Sent to ${record.tg_id} via DB Webhook`)
          }
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('[error] Handler crashed:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
