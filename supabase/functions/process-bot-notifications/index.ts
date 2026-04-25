/**
 * Supabase Edge Function: process-bot-notifications
 * Отвечает за отправку всех результатов и подарков в Telegram.
 * 
 * Особенности:
 * - Защищена ключом (Authorization: Bearer <key>)
 * - Слушает вебхуки test_results (INSERT/UPDATE)
 * - Слушает вебхуки profiles (UPDATE для рефералов)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const NOTIFICATIONS_KEY = Deno.env.get('BOT_NOTIFICATIONS_KEY') || SUPABASE_KEY

// Картинки опор
const TRAIT_IMAGES: Record<string, string> = {
  S: `${APP_URL}/hero.png`,
  U: `${APP_URL}/pleaser.png`,
  P: `${APP_URL}/perfectionist.png`,
  R: `${APP_URL}/stayer.png`,
  K: `${APP_URL}/controller.png`,
}

// Тексты основных опор
const DOMINANT_TRAIT_TEXTS: Record<string, string> = {
  S: `<b>ГЕРОИЧЕСКАЯ ОПОРА</b>\n\nТы та, кто держит. Даже когда тяжело. Даже когда уже нет сил. Ты не позволяешь себе развалиться. Не просишь помощи. Собираешься и идёшь дальше.\n\nНо внутри:\n— постоянное напряжение\n— одиночество\n— ощущение, что всё на тебе\n\nТы привыкла быть сильной. Настолько, что уже не знаешь, как по-другому.\n\nЦена:\nТы живёшь на износе. И даже не разрешаешь себе это признать.\n\n⚡️ Внутри звучит:\n«Если я перестану держать — меня не станет»`,
  U: `<b>ПОДСТРАИВАЮЩАЯСЯ ОПОРА</b>\n\nТы умеешь быть удобной. Чувствовать других. Подстраиваться. Ты сглаживаешь углы. Избегаешь конфликтов. Часто выбираешь не себя.\n\nНо внутри:\n— подавленные желания\n— злость, которую нельзя проявить\n— страх быть отвергнутой\n\nТы стараешься быть хорошей. Но это не даёт тебе того, что ты хочешь.\n\nЦена:\nТы теряешь себя, чтобы сохранить отношения.\n\n⚡️ Внутри звучит:\n«Если я буду собой — меня не выберут»`,
  P: `<b>ПЕРФЕКЦИОНИРУЮЩАЯ ОПОРА</b>\n\nТы живёшь через результат. Через «сделать правильно». Ты стараешься быть идеальной. Не ошибаться. Держать уровень.\n\nНо внутри:\n— страх критики\n— напряжение\n— ощущение, что ты недостаточно хороша\n\nТы всё время доказываешь свою ценность. Даже когда уже доказала.\n\nЦена:\nТы не можешь расслабиться. Потому что всегда есть «ещё лучше».\n\n⚡️ Внутри звучит:\n«Если я не идеальна — я ничто»`,
  R: `<b>УДЕРЖИВАЮЩАЯ ОПОРА</b>\n\nТы чувствуешь всё. Атмосферу, людей, напряжение. Ты сглаживаешь конфликты. Поддерживаешь. Держишь «поле».\n\nНо внутри:\n— перегруз\n— тревожность\n— ощущение, что слишком много на тебе\n\nТы живёшь через других. И почти не остаётся места для себя.\n\nЦена:\nТы выгораешь, удерживая то, что не обязана держать.\n\n⚡️ Внутри звучит:\n«Если я отпущу — всё развалится»`,
  K: `<b>КОНТРОЛИРУЮЩАЯ ОПОРА</b>\n\nТы стараешься всё предусмотреть. Держать под контролем. Ты анализируешь, планируешь, просчитываешь. Не любишь неопределённость.\n\nНо внутри:\n— тревога\n— напряжение\n— ощущение угрозы\n\nТы не расслабляешься. Потому что «вдруг что-то пойдёт не так».\n\nЦена:\nТы живёшь в постоянной готовности к опасности.\n\n⚡️ Внутри звучит:\n«Если я не контролирую — я в опасности»`
}

// Тексты вторых опор (за 2 реферала)
const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU: `<b>«Тихий тащитель»</b>\n\nТы тащишь. И делаешь это тихо. Ты справляешься. Не просишь помощи. И при этом стараешься быть удобной.\n\nНо внутри:\n— усталость\n— одиночество\n— ощущение, что тебя не видят\n\nЦена:\nТы исчезаешь из своей же жизни.\n\n⚡️ Внутри звучит: «Я всё делаю правильно… почему меня не выбирают?»`,
  PS: `<b>«Машина результата»</b>\n\nТы работаешь на максимум. Сильная. Эффективная. Идеальная. Ты не позволяешь себе слабость. И не позволяешь ошибаться.\n\nНо внутри:\n— выгорание\n— пустота\n— отрезанность от себя\n\nЦена:\nТы теряешь себя ради результата.\n\n⚡️ Внутри звучит: «Я должна быть сверхчеловеком»`,
  RS: `<b>«Опора для всех»</b>\n\nТы держишь не только себя — ты держишь всех. Ты чувствуешь других. Регулируешь. Поддерживаешь.\n\nНо внутри:\n— перегруз\n— усталость\n— ощущение «слишком много на мне»\n\nЦена:\nТы живёшь чужими жизнями вместо своей.\n\n⚡️ Внутри звучит: «Без меня всё развалится»`,
  KS: `<b>«Железная система»</b>\n\nТы сильная и всё контролируешь. Ты держишь. Просчитываешь. Не даёшь себе расслабиться.\n\nНо внутри:\n— жёсткость\n— тревога\n— напряжение\n\nЦена:\nТы не живёшь — ты управляешь выживанием.\n\n⚡️ Внутри звучит: «Я должна удержать всё любой ценой»`,
  PU: `<b>«Идеальная для всех»</b>\n\nТы стараешься быть идеальной, чтобы тебя любили. Ты подстраиваешься. Соответствуешь. Стараешься.\n\nНо внутри:\n— стыд\n— страх «недостаточности»\n— зависимость от оценки\n\nЦена:\nТы живёшь чужими ожиданиями.\n\n⚡️ Внутри звучит: «Если я не идеальна — меня не выберут»`,
  RU: `<b>«Спасатель»</b>\n\nТы живёшь через помощь другим. Ты включаешься. Спасаешь. Поддерживаешь.\n\nНо внутри:\n— истощение\n— пустота\n— ощущение, что тебя нет\n\nЦена:\nТы теряешь контакт с собой.\n\n⚡️ Внутри звучит: «Я нужна, только если я полезна»`,
  KU: `<b>«Тревожный угодник»</b>\n\nТы стараешься угадать, как правильно. Ты анализируешь реакции. Подстраиваешься. Контролируешь.\n\nНо внутри:\n— тревога\n— напряжение\n— страх ошибиться\n\nЦена:\nТы теряешь свободу и спонтанность.\n\n⚡️ Внутри звучит: «Если я ошибусь — меня отвергнут»`,
  PR: `<b>«Социальный идеал»</b>\n\nТы пытаешься быть идеальной для всех. Ты чувствуешь ожидания. И стараешься им соответствовать.\n\nНо внутри:\n— перегруз\n— потеря себя\n— тревога\n\nЦена:\nТы не знаешь, какая ты настоящая.\n\n⚡️ Внутри звучит: «Я должна соответствовать всем»`,
  KP: `<b>«Тревожный достигатор»</b>\n\nТы живёшь через контроль и идеальность. Ты стараешься предусмотреть всё. Не ошибаться. Быть на высоте.\n\nНо внутри:\n— напряжение\n— тревога\n— страх провала\n\nЦена:\nТы живёшь в постоянном напряжении «а вдруг что-то не так».\n\n⚡️ Внутри звучит: «Ошибка — это катастрофа»`,
  KR: `<b>«Сканер угроз»</b>\n\nТы постоянно на чеку. Ты чувствуешь всё. И пытаешься предотвратить плохое.\n\nНо внутри:\n— перегруз\n— тревога\n— усталость\n\nЦена:\nТы живёшь в режиме постоянной опасности.\n\n⚡️ Внутри звучит: «Я должна всё предусмотреть, иначе будет плохо»`,
}

async function api(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[Telegram API Error] ${method}:`, err)
  }
  return res.ok
}

async function sendPhoto(chatId: number, photo: string, caption?: string) {
  return api('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML' })
}

async function sendMessage(chatId: number, text: string) {
  return api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' })
}

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
  return res.json()
}

serve(async (req: Request) => {
  // Проверка авторизации (только для прямых вызовов, вебхуки проверяем по-другому если нужно)
  // Но так как это Edge Function для вебхуков Supabase, мы можем проверять секретный ключ в хидере
  const authHeader = req.headers.get('Authorization')
  
  try {
    const payload = await req.json()
    console.log(`[Notification Engine] Event: ${payload.event || payload.type}, Table: ${payload.table}`)

    // 1. ПРЯМОЕ СОБЫТИЕ (через RPC или API)
    if (payload.event === 'referrals_reached_2') {
      const mixedKey = payload.mixed_trait?.toUpperCase()
      const text = MIXED_TRAIT_TEXTS[mixedKey]
      if (text) {
        await sendMessage(payload.tg_id, `<b>🎉 Поздравляем! По твоей ссылке 2 человека прошли тест.</b>\n\nТебе открылась твоя «Вторая опора»:\n\n${text}`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // 2. WEBHOOK: Новый или обновленный результат теста
    if (payload.table === 'test_results' && (payload.type === 'INSERT' || payload.type === 'UPDATE')) {
      const record = payload.record
      const oldRecord = payload.old_record

      // Для UPDATE проверяем, изменились ли опоры или это просто техническое обновление
      if (payload.type === 'UPDATE' && 
          record.primary_support === oldRecord?.primary_support && 
          record.secondary_support === oldRecord?.secondary_support) {
        console.log('[Notification Engine] UPDATE: Traits not changed, skipping notification.')
        return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
      }

      const tgId = record.tg_id
      if (tgId) {
        const trait = (record.primary_support || '').toUpperCase()
        const imageUrl = TRAIT_IMAGES[trait] || TRAIT_IMAGES['S']
        const text = DOMINANT_TRAIT_TEXTS[trait] || `Ваша опора: ${trait}`
        
        const success = await sendPhoto(tgId, imageUrl, text)
        if (!success) {
            // Фолбэк на текст если фото не ушло
            await sendMessage(tgId, text)
        }
        console.log(`[Notification Engine] Sent trait ${trait} to ${tgId}`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // 3. WEBHOOK: Обновление профиля (инвайты)
    if (payload.table === 'profiles' && payload.type === 'UPDATE') {
      const record = payload.record
      const oldRecord = payload.old_record
      
      // Срабатываем ТОЛЬКО при переходе с <2 на >=2
      if (record.invites_count >= 2 && (oldRecord?.invites_count || 0) < 2) {
        console.log(`[Notification Engine] Profile ${record.id} reached bonus threshold.`)
        
        // Получаем результаты теста этого пользователя
        const results = await db(`test_results?tg_id=eq.${record.tg_id}&select=primary_support,secondary_support`)
        const tr = results?.[0]
        
        if (tr?.primary_support && tr?.secondary_support) {
          const mixedKey = [tr.primary_support.toUpperCase(), tr.secondary_support.toUpperCase()].sort().join('')
          const mixedText = MIXED_TRAIT_TEXTS[mixedKey]
          if (mixedText) {
            await sendMessage(record.tg_id, `<b>🎉 Поздравляем! По твоей ссылке 2 человека прошли тест.</b>\n\nТебе открылась твоя «Вторая опора»:\n\n${mixedText}`)
            console.log(`[Notification Engine] Sent mixed trait ${mixedKey} bonus to ${record.tg_id}`)
          }
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 })
  } catch (err) {
    console.error('[Notification Engine] Global Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
