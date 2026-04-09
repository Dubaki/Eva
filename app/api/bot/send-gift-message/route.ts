import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'
import { sendMessageToUser } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 401 })
  }

  const token = auth.slice(7)
  const payload = verifyJwt(token, jwtSecret)
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  const supabase = getSupabaseServer()

  const { data: profile } = await supabase
    .from('profiles')
    .select('tg_id')
    .eq('id', payload.sub)
    .single()

  if (!profile?.tg_id) {
    return NextResponse.json({ success: false, error: 'No Telegram chat ID' }, { status: 404 })
  }

  const giftMessage =
    'Сейчас нет смысла проходить тест повторно. ' +
    'У тебя есть 2 месяца, чтобы демонтировать текущую опору. ' +
    'Через 2 месяца ты сможешь увидеть изменения. ' +
    'Мы напомним тебе здесь.'

  const sent = await sendMessageToUser({
    chatId: profile.tg_id,
    text: giftMessage,
  })

  if (!sent) {
    console.error('[send-gift-message] Failed to send message to user')
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
