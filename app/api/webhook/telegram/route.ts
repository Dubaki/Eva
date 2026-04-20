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

export const dynamic = 'force-dynamic'

const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL ?? 'https://t.me/sprosievu'

function validateSecretToken(req: NextRequest): boolean {
  if (!SECRET_TOKEN) return true
  const token = req.headers.get('x-telegram-bot-api-secret-token')
  return token === SECRET_TOKEN
}

export async function POST(request: NextRequest) {
  if (!validateSecretToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update = await request.json()
    const message = update.message
    const callbackQuery = update.callback_query
    const from = message?.from || callbackQuery?.from
    const tgId = from?.id
    const username = from?.username

    if (!tgId) return NextResponse.json({ ok: true })

    const supabase = getSupabaseServer()

    try {
      if (callbackQuery) {
        const data = callbackQuery.data

        if (data === 'check_sub') {
          const status = await getChatMember(CHANNEL_ID!, tgId)
          const isSubscribed = ['member', 'administrator', 'creator'].includes(status || '')

          if (isSubscribed) {
            // ИСПРАВЛЕНО: Передаем как объект { callbackQueryId, text }
            await answerCallbackQuery({ 
              callbackQueryId: callbackQuery.id, 
              text: 'Спасибо за подписку! 🎉' 
            })
            await sendMessage({
              chatId: tgId,
              text: 'Подписка подтверждена! Теперь ты можешь пройти тест.',
              replyMarkup: {
                inline_keyboard: [[{ text: 'Открыть тест', web_app: { url: getTmaUrl() } }]]
              }
            })
          } else {
            // ИСПРАВЛЕНО: Передаем как объект { callbackQueryId, text, showAlert }
            await answerCallbackQuery({ 
              callbackQueryId: callbackQuery.id, 
              text: 'Ты всё ещё не подписана 😔', 
              showAlert: true 
            })
          }
        }
        return NextResponse.json({ ok: true })
      }

      const text = message?.text || ''
      if (text.startsWith('/start')) {
        const refCode = extractReferralCode(text)
        
        await supabase
          .from('profiles')
          .upsert({ 
            tg_id: tgId, 
            username: username || null,
            referred_by: refCode !== tgId ? refCode : null
          }, { onConflict: 'tg_id' })

        const status = await getChatMember(CHANNEL_ID!, tgId)
        const isSubscribed = ['member', 'administrator', 'creator'].includes(status || '')

        if (!isSubscribed) {
          await sendMessage({
            chatId: tgId,
            text: `🌿 Привет! Чтобы узнать свою опору, подпишись на мой канал. Там я делюсь тем, как оставаться в ресурсе.`,
            replyMarkup: {
              inline_keyboard: [
                [{ text: '1. Подписаться на канал', url: CHANNEL_URL }],
                [{ text: '2. Я подписалась', callback_data: 'check_sub' }]
              ]
            }
          })
        } else {
          await sendMessage({
            chatId: tgId,
            text: 'Рада видеть тебя снова! Твой тест ждет тебя.',
            replyMarkup: {
              inline_keyboard: [[{ text: 'Пройти тест', web_app: { url: getTmaUrl() } }]]
            }
          })
        }
      } 
      
      // БЛОК ПОЛУЧЕНИЯ FILE_ID ДЛЯ АДМИНОВ
      else if ((username === 'evapatrakhina' || username === 'bizbezit') && (update.message as any)?.video) {
        const videoFileId = (update.message as any).video.file_id;
        
        await sendMessage({
          chatId: tgId,
          text: `✅ <b>ID ВИДЕО ПОЛУЧЕН</b>\n\nНик: @${username}\n\n<code>${videoFileId}</code>\n\nСкопируй этот код целиком.`,
          parseMode: 'HTML'
        });
      }

      else if (text) {
        await sendMessage({
          chatId: tgId,
          text: '🌿 Чтобы начать работу, нажми кнопку ниже или введи /start',
          replyMarkup: {
            inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: getTmaUrl() } }]]
          }
        })
      }
    } catch (handlerErr) {
      console.error('WEBHOOK HANDLER ERROR:', handlerErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('WEBHOOK TOP-LEVEL ERROR:', err)
    return NextResponse.json({ ok: true })
  }
}