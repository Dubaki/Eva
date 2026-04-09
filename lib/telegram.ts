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
 * Keys are sorted alphabetically (e.g. KS not SK).
 */
export const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU:
    `Тихий тащитель\n\n` +
    `Ты тащишь.\n` +
    `И делаешь это тихо, без жалоб.\n` +
    `Берёшь больше, чем нужно.\n` +
    `Идёшь дальше, чем могут другие.\n\n` +
    `Но внутри:\n` +
    `— тихая усталость\n` +
    `— ощущение, что ты один\n` +
    `— никто не видит, сколько ты держишь\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я всё делаю правильно… почему меня не выбирают?»`,

  SP:
    `Машина результата\n\n` +
    `Ты работаешь на максимум.\n` +
    `Не останавливаешься.\n` +
    `Держишь высокую планку.\n\n` +
    `Но внутри:\n` +
    `— страх, что ты недостаточно\n` +
    `— напряжение без передышки\n` +
    `— ощущение, что ты — это только твой результат\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна быть сверхчеловеком»`,

  RS:
    `Опора для всех\n\n` +
    `Ты держишь не только себя.\n` +
    `Ты держишь других.\n` +
    `Чувствуешь, помогаешь, сглаживаешь.\n\n` +
    `Но внутри:\n` +
    `— перегруз\n` +
    `— одиночество\n` +
    `— никто не держит тебя\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Без меня всё развалится»`,

  KS:
    `Железная система\n\n` +
    `Ты сильная и всё контролируешь.\n` +
    `Планируешь, просчитываешь, держишь.\n\n` +
    `Но внутри:\n` +
    `— тревога\n` +
    `— невозможность расслабиться\n` +
    `— ощущение, что ты должна удержать всё\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна удержать всё любой ценой»`,

  PU:
    `Идеальная для всех\n\n` +
    `Ты стараешься быть идеальной.\n` +
    `Для других. Для себя.\n` +
    `Подстраиваешься, но безупречно.\n\n` +
    `Но внутри:\n` +
    `— страх не соответствовать\n` +
    `— подавленная злость\n` +
    `— ощущение, что тебя настоящую не выберут\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Если я не идеальна — меня не выберут»`,

  RU:
    `Спасатель\n\n` +
    `Ты живёшь через помощь другим.\n` +
    `Чувствуешь, подстраиваешься, поддерживаешь.\n\n` +
    `Но внутри:\n` +
    `— пустота\n` +
    `— свои потребности на нуле\n` +
    `— никто не спрашивает, как ты\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я нужна, только если я полезна»`,

  KU:
    `Тревожный угодник\n\n` +
    `Ты стараешься угадать, как правильно.\n` +
    `Предчувствуешь, подстраиваешься, контролируешь.\n\n` +
    `Но внутри:\n` +
    `— страх ошибки\n` +
    `— напряжение от чужих ожиданий\n` +
    `— тревога, что ты не угадаешь\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Если я ошибусь — меня отвергнут»`,

  PR:
    `Социальный идеал\n\n` +
    `Ты пытаешься быть идеальной.\n` +
    `В глазах других.\n` +
    `Держишь атмосферу, сглаживаешь.\n\n` +
    `Но внутри:\n` +
    `— страх быть настоящей\n` +
    `— напряжение от постоянной маски\n` +
    `— ощущение, что ты — это не ты\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна соответствовать всем»`,

  KP:
    `Тревожный достигатор\n\n` +
    `Ты живёшь через контроль и идеальность.\n` +
    `Планируешь, просчитываешь, не ошибаешься.\n\n` +
    `Но внутри:\n` +
    `— паника от любой ошибки\n` +
    `— невозможность выдохнуть\n` +
    `— страх, что всё пойдёт не так\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Ошибка — это катастрофа»`,

  KR:
    `Сканер угроз\n\n` +
    `Ты постоянно на чеку.\n` +
    `Сканируешь, чувствуешь, контролируешь.\n\n` +
    `Но внутри:\n` +
    `— хроническая тревога\n` +
    `— перегруз от чужих эмоций\n` +
    `— невозможность быть в безопасности\n\n` +
    `⚡️ Внутри звучит:\n` +
    `«Я должна всё предусмотреть, иначе будет плохо»`,
}
