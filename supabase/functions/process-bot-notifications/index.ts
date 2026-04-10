/**
 * Supabase Edge Function: process-bot-notifications
 *
 * Вызывается через HTTP POST из триггеров БД (pg_net / webhook)
 * или напрямую через Supabase Functions API.
 *
 * Payload:
 * {
 *   "event": "dominant_trait_set" | "referrals_reached_2",
 *   "profile_id": "uuid",
 *   "tg_id": 123456789,
 *   "trait": "S",           // для dominant_trait_set
 *   "mixed_trait": "SU"    // для referrals_reached_2
 * }
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN — токен бота
 *   SUPABASE_URL — URL Supabase проекта
 *   SUPABASE_SERVICE_ROLE_KEY — сервисный ключ
 *   APP_URL — базовый URL приложения (для картинок)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'

// Картинки опор — абсолютные URL
const TRAIT_IMAGES: Record<string, string> = {
  S: `${APP_URL}/hero.png`,
  U: `${APP_URL}/pleaser.png`,
  P: `${APP_URL}/perfectionist.png`,
  R: `${APP_URL}/stayer.png`,
  K: `${APP_URL}/controller.png`,
}

// Тексты доминирующих опор (полные описания)
const DOMINANT_TRAIT_TEXTS: Record<string, string> = {
  S: `🟣 <b>Самоценность</b>

Твоя доминирующая опора — Самоценность.

Ты умеешь быть с собой. Тебе не нужно постоянно подтверждать свою ценность через других.

Но это не значит, что всё идеально. Искажённая самоценность может проявляться как:
— отстранённость
— нежелание просить помощи
— ощущение «я сам/а»

Это тоже механизм защиты.

Ты научилась обходиться без других. Но иногда — можно позволить себе быть уязвимой.`,

  U: `🟣 <b>Перфекционизм</b>

Твоя доминирующая опора — Перфекционизм.

Ты стремишься к идеалу. Во всём.

Это даёт мощные результаты, но создаёт огромное внутреннее давление.

Искажённый перфекционизм проявляется как:
— страх ошибки
— невозможность остановиться
— ощущение «недостаточности»

Ты не позволяешь себе быть живой. Живые люди ошибаются. И это нормально.`,

  P: `🟣 <b>Угодничество</b>

Твоя доминирующая опора — Угодничество.

Ты чувствуешь других. Подстраиваешься. Стараешься быть удобной.

Это помогает быть принятой. Но цена — потеря себя.

Искажённое угодничество проявляется как:
— зависимость от чужого мнения
— страх сказать «нет»
— ощущение, что ты «недостаточно хорошая»

Ты уже достаточная. Не нужно это заслуживать.`,

  R: `🟣 <b>Контроль</b>

Твоя доминирующая опора — Контроль.

Ты держишь ситуацию. Регулируешь. Управляешь.

Это даёт ощущение безопасности. Но лишает свободы.

Искажённый контроль проявляется как:
— невозможность расслабиться
— гиперответственность
— ощущение «без меня всё развалится»

Ты не обязана держать всё. Можно отпустить.`,

  K: `🟣 <b>Сверхбдительность</b>

Твоя доминирующая опора — Сверхбдительность.

Ты сканируешь пространство. Чувствуешь угрозы. Готова ко всему.

Это помогает выживать. Но не помогает жить.

Искажённая сверхбдительность проявляется как:
— постоянная тревога
— невозможность доверять
— ощущение опасности даже в безопасности

Ты в безопасности. Прямо сейчас.`,
}

// Смешанные опоры — тексты
const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU: `S + U — «Тихий тащитель»

Ты тащишь. И делаешь это тихо.
Ты справляешься. Не просишь помощи.
И при этом стараешься быть удобной.

Но внутри: усталость, одиночество, ощущение, что тебя не видят.
Ты отдаёшь много. Но это не возвращается.

Цена: Ты исчезаешь из своей же жизни.

⚡️ Внутри звучит: «Я всё делаю правильно… почему меня не выбирают?»`,

  SP: `S + P — «Машина результата»

Ты работаешь на максимум. Сильная. Эффективная. Идеальная.
Ты не позволяешь себе слабость. И не позволяешь ошибаться.

Но внутри: выгорание, пустота, отрезанность от себя.
Ты как система. Но не как живая.

Цена: Ты теряешь себя ради результата.

⚡️ Внутри звучит: «Я должна быть сверхчеловеком»`,

  RS: `S + R — «Опора для всех»

Ты держишь не только себя — ты держишь всех.
Ты чувствуешь других. Регулируешь. Поддерживаешь.

Но внутри: перегруз, усталость, ощущение «слишком много на мне».
Ты несёшь больше, чем можешь.

Цена: Ты живёшь чужими жизнями вместо своей.

⚡️ Внутри звучит: «Без меня всё развалится»`,

  KS: `S + K — «Железная система»

Ты сильная и всё контролируешь.
Ты держишь. Просчитываешь. Не даёшь себе расслабиться.

Но внутри: жёсткость, тревога, напряжение.
Ты как будто всегда «на посту».

Цена: Ты не живёшь — ты управляешь выживанием.

⚡️ Внутри звучит: «Я должна удержать всё любой ценой»`,

  PU: `U + P — «Идеальная для всех»

Ты стараешься быть идеальной, чтобы тебя любили.
Ты подстраиваешься. Соответствуешь. Стараешься.

Но внутри: стыд, страх «недостаточности», зависимость от оценки.
Ты не можешь быть собой.

Цена: Ты живёшь чужими ожиданиями.

⚡️ Внутри звучит: «Если я не идеальна — меня не выберут»`,

  RU: `U + R — «Спасатель»

Ты живёшь через помощь другим.
Ты включаешься. Спасаешь. Поддерживаешь.

Но внутри: истощение, пустота, ощущение, что тебя нет.
Ты отдаёшь себя, чтобы быть нужной.

Цена: Ты теряешь контакт с собой.

⚡️ Внутри звучит: «Я нужна, только если я полезна»`,

  KU: `U + K — «Тревожный угодник»

Ты стараешься угадать, как правильно.
Ты анализируешь реакции. Подстраиваешься. Контролируешь.

Но внутри: тревога, напряжение, страх ошибиться.
Ты живёшь в режиме «не так сделать нельзя».

Цена: Ты теряешь свободу и спонтанность.

⚡️ Внутри звучит: «Если я ошибусь — меня отвергнут»`,

  PR: `P + R — «Социальный идеал»

Ты пытаешься быть идеальной для всех.
Ты чувствуешь ожидания. И стараешься им соответствовать.

Но внутри: перегруз, потеря себя, тревога.
Ты разрываешься между «как надо».

Цена: Ты не знаешь, какая ты настоящая.

⚡️ Внутри звучит: «Я должна соответствовать всем»`,

  KP: `P + K — «Тревожный достигатор»

Ты живёшь через контроль и идеальность.
Ты стараешься предусмотреть всё. Не ошибаться. Быть на высоте.

Но внутри: напряжение, тревога, страх провала.
Ты не можешь выдохнуть.

Цена: Ты живёшь в постоянном напряжении «а вдруг что-то не так».

⚡️ Внутри звучит: «Ошибка — это катастрофа»`,

  KR: `R + K — «Сканер угроз»

Ты постоянно на чеку.
Ты чувствуешь всё. И пытаешься предотвратить плохое.

Но внутри: перегруз, тревога, усталость.
Ты не расслабляешься вообще.

Цена: Ты живёшь в режиме постоянной опасности.

⚡️ Внутри звучит: «Я должна всё предусмотреть, иначе будет плохо»`,
}

interface RequestPayload {
  event: 'dominant_trait_set' | 'referrals_reached_2'
  profile_id: string
  tg_id: number
  trait?: string
  mixed_trait?: string
}

async function sendPhoto(chatId: number, photo: string, caption?: string): Promise<Response> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo,
    parse_mode: 'HTML',
  }
  if (caption) body.caption = caption

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[sendPhoto] Failed (${res.status}):`, errText)
  }
  return res
}

async function sendMessage(chatId: number, text: string): Promise<Response> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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
    console.error(`[sendMessage] Failed (${res.status}):`, errText)
  }
  return res
}

serve(async (req: Request) => {
  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Accept only POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: RequestPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { event, profile_id, tg_id, trait, mixed_trait } = payload

  if (!event || !profile_id || !tg_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields: event, profile_id, tg_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Event A: dominant_trait just set ───────────────────────────
  if (event === 'dominant_trait_set') {
    const traitKey = trait || 'S'
    const imageUrl = TRAIT_IMAGES[traitKey] || TRAIT_IMAGES['S']
    const text = DOMINANT_TRAIT_TEXTS[traitKey] || DOMINANT_TRAIT_TEXTS['S']

    const photoRes = await sendPhoto(tg_id, imageUrl, text)

    return new Response(
      JSON.stringify({ success: true, event: 'dominant_trait_set', tg_id, photo_status: photoRes.status }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Event B: referrals_count reached 2 ────────────────────────
  if (event === 'referrals_reached_2') {
    const mixedKey = mixed_trait || 'SU'
    const text = MIXED_TRAIT_TEXTS[mixedKey] || MIXED_TRAIT_TEXTS['SU']

    const msgRes = await sendMessage(tg_id, text)

    return new Response(
      JSON.stringify({ success: true, event: 'referrals_reached_2', tg_id, msg_status: msgRes.status }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
})
