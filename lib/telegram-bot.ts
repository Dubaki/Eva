/**
 * Server-side Telegram Bot API helpers.
 * Uses native fetch — no external dependencies.
 *
 * All functions use the BOT_TOKEN (server-side only, never exposed to client).
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'eva_bot'

if (!BOT_TOKEN) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN is not set. Bot API calls will fail.')
}

const BASE = 'https://api.telegram.org'

// ── Types ──────────────────────────────────────────────────────────────────

export interface InlineKeyboardButton {
  text: string
  web_app?: { url: string }
  url?: string
  callback_data?: string
}

export interface InlineKeyboard {
  inline_keyboard: InlineKeyboardButton[][]
}

// ── API Methods ────────────────────────────────────────────────────────────

/**
 * Send a message with an optional Inline Keyboard (web_app button).
 */
export async function sendMessage(params: {
  chatId: number
  text: string
  replyMarkup?: InlineKeyboard
  parseMode?: 'HTML' | 'MarkdownV2'
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: params.parseMode ?? 'HTML',
  }

  if (params.replyMarkup) {
    body.reply_markup = params.replyMarkup
  }

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] sendMessage failed (${res.status}):`, err)
    return false
  }

  return true
}

/**
 * Send a photo with optional caption and inline keyboard.
 */
export async function sendPhoto(params: {
  chatId: number
  photo: string
  caption?: string
  replyMarkup?: InlineKeyboard
  parseMode?: 'HTML' | 'MarkdownV2'
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    photo: params.photo,
  }

  if (params.caption) {
    body.caption = params.caption
    body.parse_mode = params.parseMode ?? 'HTML'
  }

  if (params.replyMarkup) {
    body.reply_markup = params.replyMarkup
  }

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] sendPhoto failed (${res.status}):`, err)
    return false
  }

  return true
}

/**
 * Check if a user is a member of a channel.
 * Returns the member status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"
 */
export async function getChatMember(chatId: string | number, userId: number): Promise<string | null> {
  if (!BOT_TOKEN) {
    console.error('[telegram] getChatMember: BOT_TOKEN not set')
    return null
  }

  console.log(`[telegram] getChatMember: checking user ${userId} in channel ${chatId}`)

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/getChatMember`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] getChatMember failed (${res.status}):`, err)
    return null
  }

  const data = await res.json()
  if (data.ok) {
    const status = data.result.status
    const isValidSubscriber = status === 'member' || status === 'administrator' || status === 'creator'
    console.log(`[telegram] getChatMember: userId=${userId}, status=${status}, isSubscriber=${isValidSubscriber}`)
    return status
  }
  console.error('[telegram] getChatMember: API returned ok=false, description:', data.description)
  return null
}

/**
 * Answer a callback query (shows a toast notification to the user).
 */
export async function answerCallbackQuery(params: {
  callbackQueryId: string
  text?: string
  showAlert?: boolean
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const body: Record<string, unknown> = {
    callback_query_id: params.callbackQueryId,
  }

  if (params.text) body.text = params.text
  if (params.showAlert) body.show_alert = params.showAlert

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] answerCallbackQuery failed (${res.status}):`, err)
    return false
  }

  return true
}

/**
 * Answer a WebApp query — opens the Mini App for the user.
 * Used in response to /start with web_app data.
 */
export async function answerWebAppQuery(params: {
  webAppQueryId: string
  url: string
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/answerWebAppQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      web_app_query_id: params.webAppQueryId,
      result: {
        type: 'web_app',
        url: params.url,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] answerWebAppQuery failed (${res.status}):`, err)
    return false
  }

  return true
}

/**
 * Set the webhook URL for the bot.
 * Call this ONCE after deployment.
 */
export async function setWebhook(params: {
  url: string
  secretToken?: string
}): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const body: Record<string, unknown> = {
    url: params.url,
    allowed_updates: ['message'],
  }

  if (params.secretToken) {
    body.secret_token = params.secretToken
  }

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] setWebhook failed (${res.status}):`, err)
    return false
  }

  const data = await res.json()
  console.log('[telegram] setWebhook response:', JSON.stringify(data, null, 2))
  return data.ok ?? false
}

/**
 * Delete the webhook (useful for testing / cleanup).
 */
export async function deleteWebhook(): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const res = await fetch(`${BASE}/bot${BOT_TOKEN}/deleteWebhook`, {
    method: 'POST',
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] deleteWebhook failed (${res.status}):`, err)
    return false
  }

  return true
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the referral code from a /start command text.
 * E.g. "/start ref_12345" → 12345  or  "/start ref12345" → 12345
 */
export function extractReferralCode(text: string): number | null {
  // Match /start ref_<digits> or /start ref<digits>
  const match = text.match(/\/start\s+ref[_-]?(\d+)/i) || text.match(/ref[_-]?(\d+)/i)
  if (match) {
    const code = parseInt(match[1], 10)
    if (!isNaN(code) && code > 0) return code
  }
  return null
}

/**
 * Returns the TMA URL for the current deployment.
 * Uses VERCEL_URL in production, falls back to localhost in dev.
 */
export function getTmaUrl(refCode?: number): string {
  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const url = new URL(baseUrl)
  if (refCode) {
    url.searchParams.set('ref', String(refCode))
  }
  return url.toString()
}
