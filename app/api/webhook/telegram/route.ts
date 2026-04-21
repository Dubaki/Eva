import { NextRequest, NextResponse } from 'next/server'
import {
  sendMessage,
  extractReferralCode,
  getTmaUrl,
  getChatMember,
  answerCallbackQuery,
} from '@/lib/telegram-bot'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL ?? 'https://t.me/sprosievu'
const AUTHOR_USERNAME = 'evapatrakhina'

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
      console.log(`[webhook] keys=${Object.keys(update).join(',')} tgId=${tgId} username=${username}`)
      console.log(`[webhook] msg keys=${message ? Object.keys(message).join(',') : 'none'} text=${message?.text?.slice(0,30) ?? 'none'}`)

      if (callbackQuery) {
        const data = callbackQuery.data

        // ── Подписка на канал ──────────────────────────────────────────
        if (data === 'check_sub') {
          const status = await getChatMember(CHANNEL_ID!, tgId)
          const isSubscribed = ['member', 'administrator', 'creator'].includes(status || '')

          if (isSubscribed) {
            await answerCallbackQuery({ callbackQueryId: callbackQuery.id, text: 'Спасибо за подписку! 🎉' })
            await sendMessage({
              chatId: tgId,
              text: 'Подписка подтверждена! Теперь ты можешь пройти тест.',
              replyMarkup: { inline_keyboard: [[{ text: 'Открыть тест', web_app: { url: getTmaUrl() } }]] }
            })
          } else {
            await answerCallbackQuery({ callbackQueryId: callbackQuery.id, text: 'Ты всё ещё не подписана 😔', showAlert: true })
          }
          return NextResponse.json({ ok: true })
        }

        // ── Quiz callbacks ─────────────────────────────────────────────
        await answerCallbackQuery({ callbackQueryId: callbackQuery.id })
        console.log(`[quiz] callback: ${data}, tgId: ${tgId}`)

        // Получаем профиль
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('tg_id', tgId)
          .limit(1)

        console.log(`[quiz] profile lookup: found=${profiles?.length}, err=${profileErr?.message}`)
        const profileId = profiles?.[0]?.id
        if (!profileId) {
          console.log(`[quiz] no profile for tgId=${tgId}, returning`)
          return NextResponse.json({ ok: true })
        }

        // Q1 → Q2
        if (data.startsWith('quiz_q1_')) {
          const sphere = data.replace('quiz_q1_', '')

          const { error: insertErr } = await supabase
            .from('qualifications')
            .insert({ profile_id: profileId, tension_sphere: sphere, tension_level: '', previous_attempts: '' } as any)
          if (insertErr) {
            await supabase.from('qualifications').update({ tension_sphere: sphere } as any).eq('profile_id', profileId)
          }
          await supabase.from('profiles').update({ bot_quiz_step: 2 } as any).eq('tg_id', tgId)

          await sendMessage({
            chatId: tgId,
            text: '<b>Насколько это ощущается остро?</b>',
            parseMode: 'HTML',
            replyMarkup: {
              inline_keyboard: [
                [{ text: 'Сильно мешает', callback_data: 'quiz_q2_hard' }],
                [{ text: 'Пока терпимо', callback_data: 'quiz_q2_medium' }],
                [{ text: 'Фоново', callback_data: 'quiz_q2_light' }],
              ]
            }
          })
        }

        // Q2 → Q3
        else if (data.startsWith('quiz_q2_')) {
          const level = data.replace('quiz_q2_', '')
          await supabase.from('qualifications').update({ tension_level: level } as any).eq('profile_id', profileId)
          await supabase.from('profiles').update({ bot_quiz_step: 3 } as any).eq('tg_id', tgId)

          await sendMessage({
            chatId: tgId,
            text: '<b>Ты уже пробовала что-то с этим делать?</b>',
            parseMode: 'HTML',
            replyMarkup: {
              inline_keyboard: [
                [{ text: 'Да, многое', callback_data: 'quiz_q3_yes' }],
                [{ text: 'Немного', callback_data: 'quiz_q3_some' }],
                [{ text: 'Нет', callback_data: 'quiz_q3_no' }],
              ]
            }
          })
        }

        // Q3 → финальное предложение
        else if (data.startsWith('quiz_q3_')) {
          const attempts = data.replace('quiz_q3_', '')
          await supabase.from('qualifications').update({ previous_attempts: attempts } as any).eq('profile_id', profileId)
          await supabase.from('profiles').update({ bot_quiz_step: 4 } as any).eq('tg_id', tgId)

          await sendMessage({
            chatId: tgId,
            text: 'Есть 2 способа работы с искаженной опорой:\n\n✓ Жёсткий, но быстрый — это группа «Пробой»\n\n✓ Мягкий и постепенный — это «Пирамида Потенциала» или персональная работа\n\nКакой способ тебе ближе?',
            replyMarkup: {
              inline_keyboard: [
                [{ text: 'Жесткий быстрый', callback_data: 'quiz_final_hard' }],
                [{ text: 'Мягкий постепенный', callback_data: 'quiz_final_soft' }],
                [{ text: 'Пока не готова', callback_data: 'quiz_final_not_ready' }],
              ]
            }
          })
        }

        // Финал: жёсткий или мягкий → ссылка на автора + подарок через 1 мин
        else if (data === 'quiz_final_hard' || data === 'quiz_final_soft') {
          const prefilledText = data === 'quiz_final_hard' ? 'Пробой!' : 'Пирамида Потенциала'
          const authorUrl = `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent(prefilledText)}`

          await supabase.from('profiles').update({ bot_quiz_step: 5 } as any).eq('tg_id', tgId)
          await (supabase as any).from('bot_tasks_queue').insert({
            profile_id: profileId,
            tg_id: tgId,
            event_type: 'send_gift',
            run_at: new Date(Date.now() + 60000).toISOString(),
            status: 'pending',
          })

          await sendMessage({
            chatId: tgId,
            text: 'Отлично! Нажми кнопку ниже — я жду твоего сообщения:',
            replyMarkup: { inline_keyboard: [[{ text: 'Написать Еве', url: authorUrl }]] }
          })
        }

        // Финал: пока не готова → подарок сразу (только если ещё не получала)
        else if (data === 'quiz_final_not_ready') {
          const { data: profileData } = await supabase.from('profiles').select('bot_quiz_step').eq('tg_id', tgId).limit(1).single()
          if ((profileData as any)?.bot_quiz_step !== 5) {
            await supabase.from('profiles').update({ bot_quiz_step: 5 } as any).eq('tg_id', tgId)
            await sendMessage({
              chatId: tgId,
              text: 'Благодарю тебя за честность! Честность — это то, на чем строятся все мои методы работы. Чтобы тест не остался просто тестом, я дарю тебе практику нейроманифестации. Ты можешь начать изменения уже сегодня.',
              replyMarkup: { inline_keyboard: [[{ text: 'Забрать подарок', callback_data: 'get_gift' }]] }
            })
          }
        }

        // Подарок (только один раз)
        else if (data === 'get_gift') {
          const { data: profileData } = await supabase.from('profiles').select('bot_quiz_step').eq('tg_id', tgId).limit(1).single()
          if ((profileData as any)?.bot_quiz_step !== 6) {
            await supabase.from('profiles').update({ bot_quiz_step: 6 } as any).eq('tg_id', tgId)
            await sendMessage({
              chatId: tgId,
              text: 'Подарок уже готовится — скоро пришлю! 🎁',
            })
          }
        }

        return NextResponse.json({ ok: true })
      }

      // ── Текстовые сообщения ────────────────────────────────────────
      const text = message?.text || ''

      if (text.startsWith('/start')) {
        const refCode = extractReferralCode(text)

        await supabase
          .from('profiles')
          .upsert({
            tg_id: tgId,
            username: username || null,
            referred_by: refCode !== tgId ? refCode : null
          } as any, { onConflict: 'tg_id' })

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
            replyMarkup: { inline_keyboard: [[{ text: 'Пройти тест', web_app: { url: getTmaUrl() } }]] }
          })
        }
      }

      // Получение file_id для администраторов
      else if (username?.toLowerCase() === 'evapatrakhina' || username?.toLowerCase() === 'bizbezit') {
        const msg = update.message as any
        const fileId = msg?.video?.file_id || msg?.document?.file_id || msg?.animation?.file_id || msg?.video_note?.file_id
        console.log(`[admin] from @${username}, types: video=${!!msg?.video} doc=${!!msg?.document} anim=${!!msg?.animation} fileId=${fileId}`)
        if (fileId) {
          await sendMessage({
            chatId: tgId,
            text: `✅ <b>FILE ID</b>\n\n<code>${fileId}</code>\n\nСкопируй целиком.`,
            parseMode: 'HTML'
          })
        }
      }

      else if (text) {
        await sendMessage({
          chatId: tgId,
          text: '🌿 Чтобы начать работу, нажми кнопку ниже или введи /start',
          replyMarkup: { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: getTmaUrl() } }]] }
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
