import { NextRequest, NextResponse } from 'next/server'
import {
  sendMessage,
  sendPhoto,
  editMessageReplyMarkup,
  extractReferralCode,
  getTmaUrl,
  getChatMember,
  answerCallbackQuery,
} from '@/lib/telegram-bot'
import { getSupabaseServer } from '@/lib/supabase/server'
import { TEXTS } from '@/lib/constants/texts'

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
    const tgId: number = from?.id
    const username: string | undefined = from?.username
    const firstName: string | undefined = from?.first_name

    if (!tgId) return NextResponse.json({ ok: true })

    const supabase = getSupabaseServer()

    try {
      // ── Callback queries ───────────────────────────────────────────────
      if (callbackQuery) {
        const data: string = callbackQuery.data
        const msgId: number = callbackQuery.message?.message_id

        // ── check_sub ──────────────────────────────────────────────────
        if (data === 'check_sub') {
          const status = await getChatMember(CHANNEL_ID!, tgId)
          const isSubscribed = ['member', 'administrator', 'creator'].includes(status ?? '')

          if (isSubscribed) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('is_subscribed')
              .eq('tg_id', tgId)
              .limit(1)
            const wasAlreadySubscribed = (profiles?.[0] as any)?.is_subscribed === true

            await supabase.from('profiles').update({ is_subscribed: true } as any).eq('tg_id', tgId)
            await answerCallbackQuery({ callbackQueryId: callbackQuery.id, text: 'Спасибо за подписку! 🎉' })
            await editMessageReplyMarkup({ chatId: tgId, messageId: msgId })

            if (!wasAlreadySubscribed) {
              const tmaUrl = getTmaUrl()
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
              const sent = await sendPhoto({
                chatId: tgId,
                photo: `${appUrl}/start1.png`,
                caption: TEXTS.bot.subscriptionConfirmed.caption,
                replyMarkup: { inline_keyboard: [[{ text: TEXTS.bot.subscriptionConfirmed.btnTest, web_app: { url: tmaUrl } }]] },
                parseMode: 'HTML',
              })
              if (!sent) {
                await sendMessage({
                  chatId: tgId,
                  text: TEXTS.bot.subscriptionConfirmed.caption,
                  replyMarkup: { inline_keyboard: [[{ text: TEXTS.bot.subscriptionConfirmed.btnTest, web_app: { url: tmaUrl } }]] },
                  parseMode: 'HTML',
                })
              }
            }
          } else {
            await answerCallbackQuery({ callbackQueryId: callbackQuery.id, text: 'Ты всё ещё не подписана 😔', showAlert: true })
          }
          return NextResponse.json({ ok: true })
        }

        // ── Quiz callbacks ─────────────────────────────────────────────
        await answerCallbackQuery({ callbackQueryId: callbackQuery.id })

        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, bot_quiz_step')
          .eq('tg_id', tgId)
          .limit(1)

        const profileRow = profiles?.[0] as any
        const profileId = profileRow?.id
        if (!profileId) return NextResponse.json({ ok: true })

        // Remove keyboard immediately
        await editMessageReplyMarkup({ chatId: tgId, messageId: msgId })

        // Q1 → Q2
        if (data.startsWith('quiz_q1_')) {
          if ((profileRow?.bot_quiz_step ?? 0) >= 2) return NextResponse.json({ ok: true })
          const sphere = data.replace('quiz_q1_', '')

          const { error: insertErr } = await supabase
            .from('qualifications')
            .insert({ profile_id: profileId, current_tension_sphere: sphere, tension_severity: '', previous_experience: '' } as any)
          if (insertErr) {
            await supabase.from('qualifications').update({ current_tension_sphere: sphere } as any).eq('profile_id', profileId)
          }
          await supabase.from('profiles').update({ bot_quiz_step: 2 } as any).eq('tg_id', tgId)

          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.quizQ2.text,
            parseMode: 'HTML',
            replyMarkup: {
              inline_keyboard: TEXTS.bot.quizQ2.options.map(o => [{ text: o.label, callback_data: o.callback }])
            }
          })
        }

        // Q2 → Q3
        else if (data.startsWith('quiz_q2_')) {
          if ((profileRow?.bot_quiz_step ?? 0) >= 3) return NextResponse.json({ ok: true })
          const level = data.replace('quiz_q2_', '')
          await supabase.from('qualifications').update({ tension_severity: level } as any).eq('profile_id', profileId)
          await supabase.from('profiles').update({ bot_quiz_step: 3 } as any).eq('tg_id', tgId)

          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.quizQ3.text,
            parseMode: 'HTML',
            replyMarkup: {
              inline_keyboard: TEXTS.bot.quizQ3.options.map(o => [{ text: o.label, callback_data: o.callback }])
            }
          })
        }

        // Q3 → финальное предложение
        else if (data.startsWith('quiz_q3_')) {
          if ((profileRow?.bot_quiz_step ?? 0) >= 4) return NextResponse.json({ ok: true })
          const attempts = data.replace('quiz_q3_', '')
          await supabase.from('qualifications').update({ previous_experience: attempts } as any).eq('profile_id', profileId)
          await supabase.from('profiles').update({ bot_quiz_step: 4 } as any).eq('tg_id', tgId)

          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.quizFinal.text,
            replyMarkup: {
              inline_keyboard: TEXTS.bot.quizFinal.options.map(o => [{ text: o.label, callback_data: o.callback }])
            }
          })

          // Ставим send_gift через 1 минуту
          await (supabase as any).from('bot_tasks_queue').insert({
            profile_id: profileId,
            tg_id: tgId,
            event_type: 'send_gift',
            run_at: new Date(Date.now() + 60000).toISOString(),
            status: 'pending',
          })
        }

        // Финал: жёсткий или мягкий
        else if (data === 'quiz_final_hard' || data === 'quiz_final_soft') {
          if ((profileRow?.bot_quiz_step ?? 0) === 5) return NextResponse.json({ ok: true })

          await supabase.from('profiles').update({ bot_quiz_step: 5, contact_author_clicked: true } as any).eq('tg_id', tgId)

          const prefilledText = data === 'quiz_final_hard' ? 'Пробой!' : 'Пирамида Потенциала'
          const authorUrl = `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent(prefilledText)}`
          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.afterFinalHard,
            replyMarkup: { inline_keyboard: [[{ text: 'Написать Еве', url: authorUrl }]] }
          })
        }

        // Финал: пока не готова
        else if (data === 'quiz_final_not_ready') {
          if ((profileRow?.bot_quiz_step ?? 0) === 5) return NextResponse.json({ ok: true })
          await supabase.from('profiles').update({ bot_quiz_step: 5 } as any).eq('tg_id', tgId)
        }

        return NextResponse.json({ ok: true })
      }

      // ── Text messages ──────────────────────────────────────────────────
      const text: string = message?.text || ''

      // Дебаг-инструмент: получение file_id от админов
      if (username?.toLowerCase() === 'evapatrakhina' || username?.toLowerCase() === 'bizbezit') {
        const msg = update.message as any
        const fileId = msg?.video?.file_id || msg?.document?.file_id || msg?.animation?.file_id || msg?.video_note?.file_id
        if (fileId) {
          await sendMessage({
            chatId: tgId,
            text: `✅ <b>FILE ID</b>\n\n<code>${fileId}</code>\n\nСкопируй целиком.`,
            parseMode: 'HTML'
          })
          return NextResponse.json({ ok: true })
        }
      }

      if (text.startsWith('/start')) {
        const refCode = extractReferralCode(text)

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, is_subscribed, referred_by')
          .eq('tg_id', tgId)
          .maybeSingle()
        
        const isExisting = !!existingProfile

        // Only set referred_by if it's a new profile and refCode is provided
        const updateData: any = {
          tg_id: tgId,
          username: username ?? null,
          first_name: firstName ?? null,
        }
        
        // If profile doesn't exist OR referred_by is currently null, we can set it
        if ((!isExisting || !existingProfile.referred_by) && refCode && refCode !== tgId) {
          updateData.referred_by = refCode
        }

        await supabase.from('profiles').upsert(updateData, { onConflict: 'tg_id' })

        const status = await getChatMember(CHANNEL_ID!, tgId)
        const isSubscribed = ['member', 'administrator', 'creator'].includes(status ?? '')

        if (isExisting && isSubscribed) {
          await supabase.from('profiles').update({ is_subscribed: true } as any).eq('tg_id', tgId)
          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.startReturning.text,
            replyMarkup: { inline_keyboard: [[{ text: TEXTS.bot.startReturning.btnTest, web_app: { url: getTmaUrl() } }]] }
          })
        } else {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
          const sent = await sendPhoto({
            chatId: tgId,
            photo: `${appUrl}/start.png`,
            caption: TEXTS.bot.welcome.caption,
            replyMarkup: {
              inline_keyboard: [
                [{ text: TEXTS.bot.welcome.btnSubscribe, url: CHANNEL_URL }],
                [{ text: TEXTS.bot.welcome.btnConfirm, callback_data: 'check_sub' }],
              ]
            },
            parseMode: 'HTML',
          })
          if (!sent) {
            await sendMessage({
              chatId: tgId,
              text: TEXTS.bot.welcome.caption,
              replyMarkup: {
                inline_keyboard: [
                  [{ text: TEXTS.bot.welcome.btnSubscribe, url: CHANNEL_URL }],
                  [{ text: TEXTS.bot.welcome.btnConfirm, callback_data: 'check_sub' }],
                ]
              },
              parseMode: 'HTML',
            })
          }
        }
      }

      else if (text.startsWith('/test')) {
        const status = await getChatMember(CHANNEL_ID!, tgId)
        const isSubscribed = ['member', 'administrator', 'creator'].includes(status ?? '')

        if (!isSubscribed) {
          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.testButtonNotSubscribed.text,
            replyMarkup: {
              inline_keyboard: [
                [{ text: TEXTS.bot.testButtonNotSubscribed.btnSubscribe, url: CHANNEL_URL }],
                [{ text: TEXTS.bot.testButtonNotSubscribed.btnConfirm, callback_data: 'check_sub' }]
              ]
            }
          })
        } else {
          await supabase.from('profiles').update({ is_subscribed: true } as any).eq('tg_id', tgId)
          await sendMessage({
            chatId: tgId,
            text: TEXTS.bot.testButtonSubscribed.text,
            replyMarkup: { inline_keyboard: [[{ text: TEXTS.bot.testButtonSubscribed.btnTest, web_app: { url: getTmaUrl() } }]] }
          })
        }
      }

      else if (text) {
        // Любое текстовое сообщение — не команда
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('tg_id', tgId)
          .maybeSingle()
        const name = (profileData as any)?.first_name || firstName || null
        await sendMessage({
          chatId: tgId,
          text: TEXTS.bot.anyMessage(name),
          replyMarkup: { inline_keyboard: [[{ text: 'Написать Еве', url: 'https://t.me/evapatrakhina' }]] }
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
