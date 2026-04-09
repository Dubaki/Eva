import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const AUTHOR_CHAT_ID = 1149371967

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ success: false, error: 'Bot token not configured' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, firstName, username, selectedFormat } = body as {
    userId?: number
    firstName?: string
    username?: string
    selectedFormat?: string
  }

  if (!userId || !selectedFormat) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  const userLink = username
    ? `@${username}`
    : `<a href="tg://user?id=${userId}">Ссылка на аккаунт</a>`

  const text =
    `🔥 <b>Горячий лид!</b>\n` +
    `Пользователь только что выбрал формат: <b>${escapeHtml(selectedFormat)}</b>\n\n` +
    `👤 Имя: ${escapeHtml(firstName ?? 'Неизвестно')}\n` +
    `🔗 Профиль: ${userLink}\n\n` +
    `<i>Если он не написал сам в течение пары минут — напиши ему первая!</i>`

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: AUTHOR_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[notify-author] Telegram API error:', err)
      return NextResponse.json({ success: false, error: 'Telegram API error' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notify-author] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
