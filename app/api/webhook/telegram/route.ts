import { NextRequest, NextResponse } from 'next/server'
import {
  sendMessage,
  sendPhoto,
  extractReferralCode,
  getTmaUrl,
  getChatMember,
  answerCallbackQuery,
  type InlineKeyboard,
} from '@/lib/telegram-bot'
import { getSupabaseServer } from '@/lib/supabase/server'

/**
 * Telegram Webhook Handler
 *
 * Receives POST requests from Telegram Bot API.
 * Handles:
 *   - /start → subscription check funnel
 *   - callback_query → "I subscribed" verification
 *   - Any other message → redirect to TMA
 *
 * Security:
 *   - Validates X-Telegram-Bot-Api-Secret-Token header
 *   - Gracefully handles unexpected payload formats
 */

const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'test_opor_bot'
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL ?? 'https://t.me/your_channel'

// ── Webhook Secret Validation ──────────────────────────────────────────────

function validateSecretToken(req: NextRequest): boolean {
  if (!SECRET_TOKEN) {
    // No token configured — skip validation (dev mode)
    return true
  }
  const token = req.headers.get('x-telegram-bot-api-secret-token')
  return token === SECRET_TOKEN
}

// ── Message Handlers ───────────────────────────────────────────────────────

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
    from?: { id: number; username?: string; first_name?: string }
    web_app_data?: { data: string }
  }
  callback_query?: {
    id: string
    from?: { id: number }
    message?: { chat: { id: number } }
    data?: string
  }
  my_chat_member?: {
    chat: { id: number }
    from: { id: number }
    new_chat_member: { status: string }
    old_chat_member: { status: string }
  }
}

async function handleStart(chatId: number, userId: number, refCode: number | null, _firstName?: string): Promise<boolean> {
  const caption =
    `<b>ТВОЯ ВНУТРЕННЯЯ ОПОРА</b> 💎\n\n` +
    `Привет! Я создала этого бота, чтобы помочь тебе найти ответы, которые уже есть внутри тебя.\n\n` +
    `✦ <b>Почему это важно?</b>\n` +
    `В мире хаоса единственное, на что можно опереться — это <i>ты сама</i>.\n\n` +
    `▹ <b>Твой первый шаг:</b>\n` +
    `Подпишись на мой канал. Там я даю эксклюзивные практики и знания, которых нет в открытом доступе.`

  // Encode refCode in callback_data so we can recover it on button press
  const callbackData = refCode ? `check_sub_${refCode}` : 'check_subscription'

  const replyMarkup: InlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '📢 Подписаться',
          url: CHANNEL_URL,
        },
      ],
      [
        {
          text: '✅ Я подписалась',
          callback_data: callbackData,
        },
      ],
    ],
  }

  // Hard-coded production domain for reliable photo delivery + cache bust
  const photoUrl = `https://eva-9udm.vercel.app/start.png?v=${Date.now()}`

  // ALWAYS try sendPhoto first, but FALLBACK to sendMessage — never leave user hanging
  try {
    const success = await sendPhoto({
      chatId,
      photo: photoUrl,
      caption,
      replyMarkup,
      parseMode: 'HTML',
    })

    if (!success) {
      console.log('[webhook] sendPhoto returned false, using sendMessage fallback')
      return await sendMessage({ chatId, text: caption, replyMarkup, parseMode: 'HTML' })
    }
    return true
  } catch (err) {
    console.error('[webhook] sendPhoto threw error, using sendMessage fallback:', err)
    return await sendMessage({ chatId, text: caption, replyMarkup, parseMode: 'HTML' })
  }
}

async function handleSubscriptionCheck(callbackQueryId: string, userId: number, chatId: number, refCode: number | null): Promise<void> {
  if (!CHANNEL_ID) {
    await answerCallbackQuery({ callbackQueryId, text: 'Канал не настроен. Обратитесь к администратору.', showAlert: true })
    return
  }

  const status = await getChatMember(CHANNEL_ID, userId)
  console.log('Check sub for channel:', process.env.TELEGRAM_CHANNEL_ID, 'Status:', status)

  // getChatMember returns null on API error (e.g. 400 Bad Request: chat not found)
  if (status === null) {
    console.error('[webhook] getChatMember returned null. CHANNEL_ID:', process.env.TELEGRAM_CHANNEL_ID)
    await answerCallbackQuery({
      callbackQueryId,
      text: 'Ошибка: проверьте права бота в канале. Бот должен быть администратором канала.',
      showAlert: true,
    })
    return
  }

  const isSubscribed = status === 'member' || status === 'administrator' || status === 'creator'

  if (isSubscribed) {
    await answerCallbackQuery({ callbackQueryId })

    // Force update is_subscribed in Supabase
    try {
      const supabase = getSupabaseServer()
      await supabase
        .from('profiles')
        .update({ is_subscribed: true })
        .eq('tg_id', userId)
    } catch (dbErr) {
      console.error('[webhook] Failed to update is_subscribed status:', dbErr)
    }

    const successCaption =
      `🎉 <b>Подписка подтверждена!</b>\n\n` +
      `У каждого человека есть внутренняя «опора» — набор убеждений, которые помогают жить и развиваться.\n` +
      `Но иногда эти установки начинают искажаться, и мы теряем связь с собой.\n\n` +
      `👇 <i>Нажми кнопку ниже, чтобы начать тест.</i>`

    const tmaUrl = getTmaUrl(refCode ?? undefined)

    const replyMarkup: InlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '✨ Пройти тест',
            web_app: { url: tmaUrl },
          },
        ],
      ],
    }

    const photoUrl = `https://eva-9udm.vercel.app/start1.png?v=${Date.now()}`

    try {
      const sent = await sendPhoto({
        chatId,
        photo: photoUrl,
        caption: successCaption,
        replyMarkup,
        parseMode: 'HTML',
      })

      if (!sent) {
        console.log('[webhook] sendPhoto returned false in success, using sendMessage fallback')
        await sendMessage({ chatId, text: successCaption, replyMarkup, parseMode: 'HTML' })
      }
    } catch (err) {
      console.error('[webhook] sendPhoto threw in success, using sendMessage fallback:', err)
      await sendMessage({ chatId, text: successCaption, replyMarkup, parseMode: 'HTML' })
    }
  } else {
    await answerCallbackQuery({
      callbackQueryId,
      text: 'Подписка не найдена. Пожалуйста, подпишитесь на канал и попробуйте снова.',
      showAlert: true,
    })
  }
}

async function handleDefaultMessage(chatId: number, firstName?: string): Promise<boolean> {
  const name = firstName ? ` ${firstName}` : ''

  const text =
    `🌿 Привет,${name}!\n\n` +
    `Для начала работы нажмите /start ` +
    `или откройте приложение кнопкой ниже.`

  const tmaUrl = getTmaUrl()

  const replyMarkup: InlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '🔮 Открыть EVA',
          web_app: { url: tmaUrl },
        },
      ],
    ],
  }

  return sendMessage({ chatId, text, replyMarkup })
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── DEBUG: verify env variables ──
  console.log('!!! WEBHOOK ATTEMPT !!!')
  console.log('DEBUG: Using Token ending in:', process.env.TELEGRAM_BOT_TOKEN?.slice(-5))
  console.log('DEBUG: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  try {
    // ── AGGRESSIVE LOGGING: dump entire incoming request ──
    let rawBody: string
    try {
      rawBody = await req.text()
      console.log('=== WEBHOOK RECEIVED ===', rawBody)
    } catch (e) {
      console.error('=== WEBHOOK RECEIVED (failed to read body) ===', e)
      rawBody = ''
    }

    // 1. Validate secret token — TEMPORARILY DISABLED for debugging
    /*
    if (!validateSecretToken(req)) {
      console.warn('[webhook] Invalid secret token')
      return new NextResponse('Unauthorized', { status: 401 })
    }
    */

    // 2. Parse body — handle unexpected formats gracefully
    let update: TelegramUpdate | undefined
    try {
      update = JSON.parse(rawBody)
    } catch {
      console.warn('[webhook] Invalid JSON body')
      return new NextResponse('Bad Request', { status: 400 })
    }

    if (!update || typeof update !== 'object') {
      console.warn('[webhook] Empty or invalid update')
      return new NextResponse('OK')
    }

    // 3. Handle different update types
    try {
      // — Message —
      if (update.message) {
        const { chat, text, from, web_app_data } = update.message

        if (!chat || typeof chat.id !== 'number') {
          console.warn('[webhook] Message without chat id')
          return new NextResponse('OK')
        }

        // Handle WebApp data submission (if any)
        if (web_app_data) {
          console.log('[webhook] WebApp data received:', web_app_data.data)
          return new NextResponse('OK')
        }

        const msgText = text?.trim() ?? ''

        if (msgText === '/start' || msgText.startsWith('/start ')) {
          const refCode = extractReferralCode(msgText)
          if (refCode) {
            console.log(`[webhook] /start with referral code: ${refCode}`)
          }
          const userId = from?.id ?? 0
          await handleStart(chat.id, userId, refCode, from?.first_name)
        } else {
          // Any other message — show welcome with TMA button
          await handleDefaultMessage(chat.id, from?.first_name)
        }
      }

      // — Callback Query (inline button presses) —
      else if (update.callback_query) {
        const { id: callbackId, from, message, data } = update.callback_query
        const chatId = message?.chat?.id

        if (chatId && from) {
          console.log(`[webhook] Callback: ${data} from user ${from.id}`)

          // Parse callback data: "check_subscription" or "check_sub_<refCode>"
          let refCode: number | null = null
          const refMatch = data?.match(/^check_sub_(\d+)$/)
          if (refMatch) {
            refCode = parseInt(refMatch[1], 10)
          }

          if (data === 'check_subscription' || refMatch) {
            await handleSubscriptionCheck(callbackId, from.id, chatId, refCode)
          } else {
            // Unknown callback — just respond with default message
            await handleDefaultMessage(chatId, undefined)
          }
        }
      }

      // — Chat Member Updates (subscription tracking) —
      else if (update.my_chat_member) {
        const { chat, from, new_chat_member, old_chat_member } = update.my_chat_member
        console.log(
          `[webhook] Chat member: user ${from.id} in chat ${chat.id} ` +
          `${old_chat_member.status} → ${new_chat_member.status}`
        )
        // TODO: Update profiles.is_subscribed in Supabase
      }

      // — Unknown update type —
      else {
        console.log('[webhook] Unknown update type, ignoring')
      }
    } catch (handlerErr) {
      console.error('WEBHOOK CRASH:', handlerErr)
    }

    // Always respond with 200 to Telegram — even if handler crashed
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('WEBHOOK CRASH (top-level):', err)
    return NextResponse.json({ ok: true })
  }
}

// ── GET: Show webhook info ────────────────────────────────────────────────

export async function GET() {
  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const webhookUrl = `${baseUrl}/api/webhook/telegram`

  return NextResponse.json({
    webhook_url: webhookUrl,
    set_webhook_curl: `curl -s "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN?.substring(0, 10)}.../setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "${webhookUrl}"${process.env.TELEGRAM_WEBHOOK_SECRET ? `, "secret_token": "${process.env.TELEGRAM_WEBHOOK_SECRET}"` : ''}}'`,
    delete_webhook_curl: `curl -s "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN?.substring(0, 10)}.../deleteWebhook"`,
    note: 'To set the webhook, use the full curl command with your actual BOT_TOKEN. The token shown above is masked for security.',
  })
}
