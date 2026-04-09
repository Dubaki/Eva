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
  const refInfo = refCode
    ? `\n\nВы перешли по приглашению друга!`
    : ''

  const text =
    `Привет! Перед тем как начать, подпишись на канал. Там я даю информацию, которую не даю больше нигде.${refInfo}`

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

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return sendPhoto({
    chatId,
    photo: `${baseUrl}/pleaser.png`,
    caption: text,
    replyMarkup,
  })
}

async function handleSubscriptionCheck(callbackQueryId: string, userId: number, chatId: number, refCode: number | null): Promise<void> {
  if (!CHANNEL_ID) {
    await answerCallbackQuery({ callbackQueryId, text: 'Канал не настроен. Обратитесь к администратору.', showAlert: true })
    return
  }

  const status = await getChatMember(CHANNEL_ID, userId)

  const isSubscribed = status === 'member' || status === 'administrator' || status === 'creator'

  if (isSubscribed) {
    await answerCallbackQuery({ callbackQueryId })

    const refInfo = refCode ? `\n\nВы перешли по приглашению друга!` : ''

    const successText = `Отлично! Добро пожаловать!${refInfo}\n\nНажмите кнопку ниже, чтобы начать тест.`

    const tmaUrl = getTmaUrl(refCode ?? undefined)

    const replyMarkup: InlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '✨ Начать тест',
            web_app: { url: tmaUrl },
          },
        ],
      ],
    }

    await sendMessage({ chatId, text: successText, replyMarkup })
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
  try {
    // 1. Validate secret token
    if (!validateSecretToken(req)) {
      console.warn('[webhook] Invalid secret token')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Parse body — handle unexpected formats gracefully
    let update: TelegramUpdate | undefined
    try {
      update = await req.json()
    } catch {
      console.warn('[webhook] Invalid JSON body')
      return new NextResponse('Bad Request', { status: 400 })
    }

    if (!update || typeof update !== 'object') {
      console.warn('[webhook] Empty or invalid update')
      return new NextResponse('OK')
    }

    // 3. Handle different update types

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

    // Always respond with 200 to Telegram
    return new NextResponse('OK')
  } catch (err) {
    console.error('[webhook] Unexpected error:', err)
    // Still respond with 200 — Telegram will retry on 5xx
    return new NextResponse('Internal Server Error', { status: 500 })
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
