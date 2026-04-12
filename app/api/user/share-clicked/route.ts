import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/telegram-bot'

/**
 * POST /api/user/share-clicked
 *
 * Called when user clicks "Поделиться" in the referral screen.
 * Triggers the bot to send 2 messages: instruction + ready-to-forward text.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tgId: number = body?.tgId

    if (!tgId || typeof tgId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid tgId' },
        { status: 400 }
      )
    }

    console.log(`[share-clicked] Request from tgId=${tgId}`)

    // Get user's referral link
    const supabase = getSupabaseServer()
    const { data: profile } = await supabase
      .from('profiles')
      .select('tg_id')
      .eq('tg_id', tgId)
      .single()

    const refLink = profile
      ? `https://t.me/sprosievubot?start=ref_${profile.tg_id}`
      : 'https://t.me/sprosievubot'

    // Message 1: Instruction
    await sendMessage({
      chatId: tgId,
      text:
        `📋 <b>Как поделиться тестом:</b>\n\n` +
        `1. Скопируй текст ниже (нажми и удерживай)\n` +
        `2. Отправь его подруге в личные сообщения\n` +
        `3. Или перешли в чат/группу\n\n` +
        `Когда она пройдёт тест — тебе откроется теневая опора!`,
      parseMode: 'HTML',
    })

    // Message 2: Ready-to-forward text with link
    await sendMessage({
      chatId: tgId,
      text:
        `✨ Пройди тест и узнай, какой механизм снова и снова приводит тебя к одним и тем же проблемам.\n\n` +
        `👉 ${refLink}`,
      parseMode: 'HTML',
    })

    console.log(`[share-clicked] Bot messages sent to tgId=${tgId}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[share-clicked] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
