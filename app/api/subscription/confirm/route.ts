import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPhoto, sendMessage, getTmaUrl } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tgId = body.tgId

    if (!tgId) return NextResponse.json({ success: false, error: 'Не передан tgId' }, { status: 400 })

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID

    // ЖЕСТКАЯ ПРОВЕРКА: Если ключей нет, выдаем ошибку на экран!
    if (!BOT_TOKEN || !CHANNEL_ID) {
      return NextResponse.json({ success: false, error: 'ОШИБКА СЕРВЕРА: Не настроены TELEGRAM_BOT_TOKEN или TELEGRAM_CHANNEL_ID' }, { status: 500 })
    }

    // 1. Делаем прямой запрос в Telegram API (как это делает бот)
    const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${tgId}`)
    const tgData = await tgResponse.json()

    if (!tgData.ok || !tgData.result) {
       return NextResponse.json({ success: false, error: 'not_subscribed' }, { status: 403 })
    }

    const status = tgData.result.status
    if (status === 'left' || status === 'kicked' || status === 'restricted') {
       return NextResponse.json({ success: false, error: 'not_subscribed' }, { status: 403 })
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 2. Ищем профиль или создаем его легально
    let { data: profiles } = await supabaseAdmin.from('profiles').select('id, tg_id').eq('tg_id', tgId).limit(1)
    let profile = profiles && profiles.length > 0 ? profiles[0] : null

    if (!profile) {
      const { data: newProfiles, error: insertErr } = await supabaseAdmin.from('profiles')
        .insert([{ tg_id: tgId, is_subscribed: true }])
        .select('id, tg_id')
      
      if (insertErr) return NextResponse.json({ success: false, error: `Ошибка БД: ${insertErr.message}` }, { status: 500 })
      if (newProfiles && newProfiles.length > 0) profile = newProfiles[0]
    }

    if (!profile) return NextResponse.json({ success: false, error: 'Ошибка БД: Профиль не создан' }, { status: 500 })

    await supabaseAdmin.from('profiles').update({ is_subscribed: true }).eq('tg_id', tgId)

    // Send confirmation message to user in Telegram (mirrors bot's handleSubscriptionCheck)
    try {
      const successCaption =
        `🎉 <b>Подписка подтверждена!</b>\n\n` +
        `У каждого человека есть внутренняя «опора» — набор убеждений, которые помогают жить и развиваться.\n` +
        `Но иногда эти установки начинают искажаться, и мы теряем связь с собой.\n\n` +
        `👇 <i>Нажми кнопку ниже, чтобы начать тест.</i>`
      const tmaUrl = getTmaUrl()
      const replyMarkup = {
        inline_keyboard: [[{ text: '✨ Пройти тест', web_app: { url: tmaUrl } }]],
      }
      const photoUrl = `https://eva-9udm.vercel.app/start1.png?v=${Date.now()}`
      const sent = await sendPhoto({ chatId: Number(tgId), photo: photoUrl, caption: successCaption, replyMarkup, parseMode: 'HTML' })
      if (!sent) {
        await sendMessage({ chatId: Number(tgId), text: successCaption, replyMarkup, parseMode: 'HTML' })
      }
    } catch (notifyErr) {
      console.error('[subscription/confirm] Failed to send Telegram notification (non-fatal):', notifyErr)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}