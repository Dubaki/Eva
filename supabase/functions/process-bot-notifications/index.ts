/**
 * Supabase Edge Function: process-bot-notifications
 *
 * Поддерживает два режима вызова:
 *
 * 1. Database Webhook (Supabase Database Functions → Webhook):
 *    Payload: стандартный Supabase webhook (INSERT/UPDATE)
 *    {
 *      "type": "INSERT" | "UPDATE",
 *      "table": "profiles",
 *      "record": { "id": "...", "tg_id": 123, "dominant_trait": "S", "shadow_trait": "U", ... },
 *      "old_record": { ... } | null
 *    }
 *
 * 2. Direct API call (из Next.js через bot-notification.ts):
 *    {
 *      "event": "dominant_trait_set" | "referrals_reached_2",
 *      "profile_id": "uuid",
 *      "tg_id": 123456789,
 *      "trait": "S",
 *      "mixed_trait": "SU"
 *    }
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN — токен бота
 *   APP_URL — базовый URL приложения (для картинок)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'

console.log('[init] BOT_TOKEN configured:', BOT_TOKEN ? 'yes' : 'no')
console.log('[init] APP_URL:', APP_URL)

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

Это даёт ощущение безопасности. Но лищает свободы.

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

// ── Telegram API helpers ────────────────────────────────────────────

async function sendPhoto(chatId: number, photo: string, caption?: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('[sendPhoto] TELEGRAM_BOT_TOKEN not set')
    return false
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo,
    parse_mode: 'HTML',
  }
  if (caption) body.caption = caption

  console.log(`[sendPhoto] Sending to chatId=${chatId}, photo=${photo}`)

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[sendPhoto] Failed (${res.status}):`, errText)
    return false
  }
  console.log('[sendPhoto] Success')
  return true
}

async function sendMessage(chatId: number, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('[sendMessage] TELEGRAM_BOT_TOKEN not set')
    return false
  }

  console.log(`[sendMessage] Sending to chatId=${chatId}`)

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
    return false
  }
  console.log('[sendMessage] Success')
  return true
}

// ── Webhook payload type (Supabase Database Webhook) ────────────────

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, unknown>
  old_record?: Record<string, unknown> | null
  schema: string
}

interface DirectPayload {
  event: 'dominant_trait_set' | 'referrals_reached_2'
  profile_id: string
  tg_id: number
  trait?: string
  mixed_trait?: string
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (!BOT_TOKEN) {
    console.error('[handler] TELEGRAM_BOT_TOKEN not configured')
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

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log('[handler] Received payload:', JSON.stringify(raw, null, 2))

  // ── Mode 1: Direct API call from Next.js ──────────────────────────
  const direct = raw as DirectPayload
  if (direct.event && direct.tg_id) {
    console.log(`[handler] Direct mode: event=${direct.event}, tg_id=${direct.tg_id}`)

    if (direct.event === 'dominant_trait_set') {
      const traitKey = direct.trait || 'S'
      const imageUrl = TRAIT_IMAGES[traitKey] || TRAIT_IMAGES['S']
      const text = DOMINANT_TRAIT_TEXTS[traitKey] || DOMINANT_TRAIT_TEXTS['S']

      const ok = await sendPhoto(direct.tg_id, imageUrl, text)
      return new Response(
        JSON.stringify({ success: true, event: 'dominant_trait_set', tg_id: direct.tg_id, sent: ok }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (direct.event === 'referrals_reached_2') {
      const mixedKey = direct.mixed_trait || 'SU'
      const text = MIXED_TRAIT_TEXTS[mixedKey] || MIXED_TRAIT_TEXTS['SU']

      const ok = await sendMessage(direct.tg_id, text)
      return new Response(
        JSON.stringify({ success: true, event: 'referrals_reached_2', tg_id: direct.tg_id, sent: ok }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ error: `Unknown event: ${direct.event}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Mode 2: Database Webhook from Supabase ────────────────────────
  const webhook = raw as WebhookPayload

  if (!webhook.type || !webhook.table || !webhook.record) {
    console.error('[handler] Unrecognized payload format')
    return new Response(JSON.stringify({ error: 'Unrecognized payload format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`[handler] Webhook mode: type=${webhook.type}, table=${webhook.table}`)

  if (webhook.table !== 'profiles') {
    console.log('[handler] Ignoring — not profiles table')
    return new Response(JSON.stringify({ ignored: true }), { status: 200 })
  }

  const record = webhook.record
  const oldRecord = webhook.old_record || {}
  const tgId = record.tg_id as number | null
  const dominantTrait = record.dominant_trait as string | null
  const shadowTrait = record.shadow_trait as string | null
  const oldDominantTrait = oldRecord.dominant_trait as string | null
  const oldReferralsCount = (oldRecord.referrals_count as number) ?? 0
  const newReferralsCount = (record.referrals_count as number) ?? 0

  if (!tgId) {
    console.log('[handler] No tg_id in record, skipping')
    return new Response(JSON.stringify({ skipped: 'no_tg_id' }), { status: 200 })
  }

  // ── Rule A: dominant_trait was just set (was null, now not null) ──
  if (webhook.type === 'INSERT' && dominantTrait) {
    console.log(`[handler] INSERT with dominant_trait=${dominantTrait}, sending photo to tgId=${tgId}`)

    const traitKey = dominantTrait.toUpperCase()
    const imageUrl = TRAIT_IMAGES[traitKey] || TRAIT_IMAGES['S']
    const text = DOMINANT_TRAIT_TEXTS[traitKey] || DOMINANT_TRAIT_TEXTS['S']

    const ok = await sendPhoto(tgId, imageUrl, text)
    return new Response(
      JSON.stringify({ success: true, action: 'dominant_trait_insert', tg_id: tgId, sent: ok }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (webhook.type === 'UPDATE' && !oldDominantTrait && dominantTrait) {
    console.log(`[handler] UPDATE: dominant_trait set from null to ${dominantTrait}, sending photo to tgId=${tgId}`)

    const traitKey = dominantTrait.toUpperCase()
    const imageUrl = TRAIT_IMAGES[traitKey] || TRAIT_IMAGES['S']
    const text = DOMINANT_TRAIT_TEXTS[traitKey] || DOMINANT_TRAIT_TEXTS['S']

    const ok = await sendPhoto(tgId, imageUrl, text)
    return new Response(
      JSON.stringify({ success: true, action: 'dominant_trait_updated', tg_id: tgId, sent: ok }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Rule B: referrals_count reached 2 ─────────────────────────────
  if (webhook.type === 'UPDATE' && oldReferralsCount < 2 && newReferralsCount >= 2 && dominantTrait && shadowTrait) {
    console.log(`[handler] UPDATE: referrals_count ${oldReferralsCount} -> ${newReferralsCount}, sending mixed trait to tgId=${tgId}`)

    const mixedKey = [dominantTrait.toUpperCase(), shadowTrait.toUpperCase()].sort().join('')
    const text = MIXED_TRAIT_TEXTS[mixedKey] || `Твоя смешанная опора: ${mixedKey}`

    const ok = await sendMessage(tgId, text)
    return new Response(
      JSON.stringify({ success: true, action: 'referrals_reached_2', tg_id: tgId, mixed_trait: mixedKey, sent: ok }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log('[handler] No matching rule triggered, skipping')
  return new Response(JSON.stringify({ skipped: 'no_matching_rule' }), { status: 200 })
})
