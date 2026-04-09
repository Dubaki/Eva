/**
 * Server-side Telegram Bot API helpers.
 * Uses native fetch — no external dependencies.
 * Uses TELEGRAM_BOT_TOKEN (server-side only).
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

if (!BOT_TOKEN) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN is not set. Bot API calls will fail.')
}

const BASE = 'https://api.telegram.org'

/**
 * Send a photo with optional caption and inline keyboard.
 */
export async function sendPhotoToUser(params: {
  chatId: number
  photo: string
  caption?: string
  replyMarkup?: object
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    photo: params.photo,
    parse_mode: 'HTML',
  }

  if (params.caption) body.caption = params.caption
  if (params.replyMarkup) body.reply_markup = params.replyMarkup

  try {
    const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[telegram] sendPhotoToUser failed (${res.status}):`, err)
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] sendPhotoToUser error:', err)
    return false
  }
}

/**
 * Send a text message to a user.
 */
export async function sendMessageToUser(params: {
  chatId: number
  text: string
  replyMarkup?: object
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: 'HTML',
  }

  if (params.replyMarkup) body.reply_markup = params.replyMarkup

  try {
    const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[telegram] sendMessageToUser failed (${res.status}):`, err)
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] sendMessageToUser error:', err)
    return false
  }
}

/**
 * Mixed trait texts (secondary / shadow layer).
 * Keys are sorted alphabetically.
 * Exact texts from ТЗ.
 */
export const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU:
    `S + U — «Тихий тащитель»\n\n` +
    `Ты тащишь.\n` +
    `И делаешь это тихо.\n` +
    `Ты справляешься.\n` +
    `Не просишь помощи.\n` +
    `И при этом стараешься быть удобной.\n\n` +
    `Но внутри:\n` +
    `— усталость\n` +
    `— одиночество\n` +
    `— ощущение, что тебя не видят\n\n` +
    `Ты отдаёшь много.\n` +
    `Но это не возвращается.\n\n` +
    `Цена:\n` +
    `Ты исчезаешь из своей же жизни.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я всё делаю правильно… почему меня не выбирают?»`,

  SP:
    `S + P — «Машина результата»\n\n` +
    `Ты работаешь на максимум.\n` +
    `Сильная. Эффективная. Идеальная.\n` +
    `Ты не позволяешь себе слабость.\n` +
    `И не позволяешь ошибаться.\n\n` +
    `Но внутри:\n` +
    `— выгорание\n` +
    `— пустота\n` +
    `— отрезанность от себя\n\n` +
    `Ты как система.\n` +
    `Но не как живая.\n\n` +
    `Цена:\n` +
    `Ты теряешь себя ради результата.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна быть сверхчеловеком»`,

  RS:
    `S + R — «Опора для всех»\n\n` +
    `Ты держишь не только себя — ты држишь всех.\n` +
    `Ты чувствуешь других.\n` +
    `Регулируешь. Поддерживаешь.\n\n` +
    `Но внутри:\n` +
    `— перегруз\n` +
    `— усталость\n` +
    `— ощущение «слишком много на мне»\n\n` +
    `Ты несёшь больше, чем можешь.\n\n` +
    `Цена:\n` +
    `Ты живёшь чужими жизнями вместо своей.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Без меня всё развалится»`,

  KS:
    `S + K — «Железная система»\n\n` +
    `Ты сильная и всё контролируешь.\n` +
    `Ты держишь. Просчитываешь.\n` +
    `Не даёшь себе расслабиться.\n\n` +
    `Но внутри:\n` +
    `— жёсткость\n` +
    `— тревога\n` +
    `— напряжение\n\n` +
    `Ты как будто всегда «на посту».\n\n` +
    `Цена:\n` +
    `Ты не живёшь — ты управляешь выживанием.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна удержать всё любой ценой»`,

  PU:
    `U + P — «Идеальная для всех»\n\n` +
    `Ты стараешься быть идеальной, чтобы тебя любили.\n` +
    `Ты подстраиваешься.\n` +
    `Соответствуешь. Стараешься.\n\n` +
    `Но внутри:\n` +
    `— стыд\n` +
    `— страх «недостаточности»\n` +
    `— зависимость от оценки\n\n` +
    `Ты не можешь быть собой.\n\n` +
    `Цена:\n` +
    `Ты живёшь чужими ожиданиями.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Если я не идеальна — меня не выберут»`,

  RU:
    `U + R — «Спасатель»\n\n` +
    `Ты живёшь через помощь другим.\n` +
    `Ты включаешься.\n` +
    `Спасаешь. Поддерживаешь.\n\n` +
    `Но внутри:\n` +
    `— истощение\n` +
    `— пустота\n` +
    `— ощущение, что тебя нет\n\n` +
    `Ты отдаёшь себя, чтобы быть нужной.\n\n` +
    `Цена:\n` +
    `Ты теряешь контакт с собой.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я нужна, только если я полезна»`,

  KU:
    `U + K — «Тревожный угодник»\n\n` +
    `Ты стараешься угадать, как правильно.\n` +
    `Ты анализируешь реакции.\n` +
    `Подстраиваешься. Контролируешь.\n\n` +
    `Но внутри:\n` +
    `— тревога\n` +
    `— напряжение\n` +
    `— страх ошибиться\n\n` +
    `Ты живёшь в режиме «не так сделать нельзя».\n\n` +
    `Цена:\n` +
    `Ты теряешь свободу и спонтанность.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Если я ошибусь — меня отвергнут»`,

  PR:
    `P + R — «Социальный идеал»\n\n` +
    `Ты пытаешься быть идеальной для всех.\n` +
    `Ты чувствуешь ожидания.\n` +
    `И стараешься им соответствовать.\n\n` +
    `Но внутри:\n` +
    `— перегруз\n` +
    `— потеря себя\n` +
    `— тревога\n\n` +
    `Ты разрываешься между «как надо».\n\n` +
    `Цена:\n` +
    `Ты не знаешь, какая ты настоящая.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна соответствовать всем»`,

  KP:
    `P + K — «Тревожный достигатор»\n\n` +
    `Ты живёшь через контроль и идеальность.\n` +
    `Ты стараешься предусмотреть всё.\n` +
    `Не ошибаться. Быть на высоте.\n\n` +
    `Но внутри:\n` +
    `— напряжение\n` +
    `— тревога\n` +
    `— страх провала\n\n` +
    `Ты не можешь выдохнуть.\n\n` +
    `Цена:\n` +
    `Ты живёшь в постоянном напряжении «а вдруг что-то не так».\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Ошибка — это катастрофа»`,

  KR:
    `R + K — «Сканер угроз»\n\n` +
    `Ты постоянно на чеку.\n` +
    `Ты чувствуешь всё.\n` +
    `И пытаешься предотвратить плохое.\n\n` +
    `Но внутри:\n` +
    `— перегруз\n` +
    `— тревога\n` +
    `— усталость\n\n` +
    `Ты не расслабляешься вообще.\n\n` +
    `Цена:\n` +
    `Ты живёшь в режиме постоянной опасности.\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна всё предусмотреть, иначе будет плохо»`,
}
