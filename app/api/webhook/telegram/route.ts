import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as bot from '@/lib/telegram-bot'
import { TEXTS } from '@/lib/constants/texts'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function POST(req: NextRequest) {
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (webhookSecret && secretToken !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update = await req.json()
    console.log('[webhook] Update received')

    if (update.message) {
      await handleMessage(update.message)
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook] Error:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to TG
  }
}

async function handleMessage(msg: any) {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const text = msg.text || ''
  const currentAppUrl = process.env.NEXT_PUBLIC_APP_URL!
  const channelUrl = process.env.TELEGRAM_CHANNEL_URL!

  // 1. Debug: file_id catcher for admins
  if (msg.video && (msg.from.username === 'evapatrakhina' || msg.from.username === 'bizbezit')) {
    await bot.sendMessage({
      chatId,
      text: `✅ FILE ID:\n<code>${msg.video.file_id}</code>`,
    })
    return
  }

  // 2. Commands
  if (text.startsWith('/start')) {
    const refId = bot.extractReferralCode(text)
    
    // UPSERT profile
    const { data: profile } = await supabase.from('profiles').upsert({
      tg_id: userId,
      username: msg.from.username || null,
      first_name: msg.from.first_name || null,
      last_name: msg.from.last_name || null,
      referred_by: refId && refId !== userId ? refId : undefined
    }, { onConflict: 'tg_id' }).select().single()

    if (!profile?.is_subscribed) {
      // Welcome msg #1
      await bot.sendPhoto({
        chatId,
        photo: `${currentAppUrl}/start.png`,
        caption: TEXTS.bot.welcome.caption,
        replyMarkup: {
          inline_keyboard: [
            [{ text: TEXTS.bot.welcome.btnSubscribe, url: channelUrl }],
            [{ text: TEXTS.bot.welcome.btnConfirm, callback_data: 'check_sub' }]
          ]
        }
      })
    } else {
      // Returning msg
      await bot.sendMessage({
        chatId,
        text: TEXTS.bot.startReturning.text,
        replyMarkup: {
          inline_keyboard: [[{ text: TEXTS.bot.startReturning.btnTest, web_app: { url: currentAppUrl } }]]
        }
      })
    }
    return
  }

  if (text === '/test') {
    const { data: profile } = await supabase.from('profiles').select('is_subscribed').eq('tg_id', userId).single()
    if (profile?.is_subscribed) {
      await bot.sendMessage({
        chatId,
        text: TEXTS.bot.testButtonSubscribed.text,
        replyMarkup: {
          inline_keyboard: [[{ text: TEXTS.bot.testButtonSubscribed.btnTest, web_app: { url: currentAppUrl } }]]
        }
      })
    } else {
      await bot.sendMessage({
        chatId,
        text: TEXTS.bot.testButtonNotSubscribed.text,
        replyMarkup: {
          inline_keyboard: [
            [{ text: TEXTS.bot.welcome.btnSubscribe, url: channelUrl }],
            [{ text: TEXTS.bot.welcome.btnConfirm, callback_data: 'check_sub' }]
          ]
        }
      })
    }
    return
  }

  // 3. Any other text
  await bot.sendMessage({
    chatId,
    text: TEXTS.bot.anyMessage(msg.from.first_name),
    replyMarkup: {
      inline_keyboard: [[{ text: 'Написать Еве', url: 'https://t.me/evapatrakhina' }]]
    }
  })
}

async function handleCallbackQuery(cb: any) {
  const chatId = cb.message.chat.id
  const userId = cb.from.id
  const data = cb.data
  const currentAppUrl = process.env.NEXT_PUBLIC_APP_URL!
  const currentChannelId = process.env.TELEGRAM_CHANNEL_ID!

  if (data === 'check_sub') {
    const status = await bot.getChatMember(currentChannelId, userId)
    const isSub = status === 'member' || status === 'administrator' || status === 'creator'

    if (isSub) {
      const { data: profile } = await supabase.from('profiles').select('is_subscribed').eq('tg_id', userId).single()
      
      await supabase.from('profiles').update({ is_subscribed: true, subscribed_at: new Date().toISOString() }).eq('tg_id', userId)

      if (!profile?.is_subscribed) {
        // Confirmation msg #2
        await bot.sendPhoto({
          chatId,
          photo: `${currentAppUrl}/start1.png`,
          caption: TEXTS.bot.subscriptionConfirmed.caption,
          replyMarkup: {
            inline_keyboard: [[{ text: TEXTS.bot.subscriptionConfirmed.btnTest, web_app: { url: currentAppUrl } }]]
          }
        })
      }
      await bot.answerCallbackQuery({ callbackQueryId: cb.id, text: 'Спасибо за подписку! 🎉' })
    } else {
      await bot.answerCallbackQuery({ callbackQueryId: cb.id, text: 'Ты всё ещё не подписана 😔', showAlert: true })
    }
    return
  }

  // Quiz callbacks
  if (data.startsWith('quiz_')) {
    const { data: profile } = await supabase.from('profiles').select('id, bot_quiz_step').eq('tg_id', userId).single()
    if (!profile) return

    // Step 1 -> Q1 answer -> Step 2 (send Q2)
    if (data.startsWith('quiz_q1_')) {
      if (profile.bot_quiz_step !== 1) {
        await bot.answerCallbackQuery({ callbackQueryId: cb.id, text: 'Ответ уже сохранён' })
        return
      }
      const val = data.replace('quiz_q1_', '')
      await supabase.from('qualifications').upsert({ profile_id: profile.id, current_tension_sphere: val })
      await supabase.from('profiles').update({ bot_quiz_step: 2 }).eq('id', profile.id)
      
      await bot.editMessageReplyMarkup({ chatId, messageId: cb.message.message_id })
      await bot.sendMessage({
        chatId,
        text: TEXTS.bot.quizQ2.text,
        replyMarkup: { inline_keyboard: TEXTS.bot.quizQ2.options.map(o => [{ text: o.label, callback_data: o.callback }]) }
      })
    }

    // Step 2 -> Q2 answer -> Step 3 (send Q3)
    else if (data.startsWith('quiz_q2_')) {
      if (profile.bot_quiz_step !== 2) {
        await bot.answerCallbackQuery({ callbackQueryId: cb.id, text: 'Ответ уже сохранён' })
        return
      }
      const val = data.replace('quiz_q2_', '')
      await supabase.from('qualifications').update({ tension_severity: val }).eq('profile_id', profile.id)
      await supabase.from('profiles').update({ bot_quiz_step: 3 }).eq('id', profile.id)

      await bot.editMessageReplyMarkup({ chatId, messageId: cb.message.message_id })
      await bot.sendMessage({
        chatId,
        text: TEXTS.bot.quizQ3.text,
        replyMarkup: { inline_keyboard: TEXTS.bot.quizQ3.options.map(o => [{ text: o.label, callback_data: o.callback }]) }
      })
    }

    // Step 3 -> Q3 answer -> Step 4 (send Final)
    else if (data.startsWith('quiz_q3_')) {
      if (profile.bot_quiz_step !== 3) {
        await bot.answerCallbackQuery({ callbackQueryId: cb.id, text: 'Ответ уже сохранён' })
        return
      }
      const val = data.replace('quiz_q3_', '')
      await supabase.from('qualifications').update({ previous_experience: val }).eq('profile_id', profile.id)
      await supabase.from('profiles').update({ bot_quiz_step: 4 }).eq('id', profile.id)

      await bot.editMessageReplyMarkup({ chatId, messageId: cb.message.message_id })
      await bot.sendMessage({
        chatId,
        text: TEXTS.bot.quizFinal.text,
        replyMarkup: { inline_keyboard: TEXTS.bot.quizFinal.options.map(o => [{ text: o.label, callback_data: o.callback }]) }
      })
      
      // Schedule send_gift task (+60s)
      await supabase.from('bot_tasks_queue').insert({
        profile_id: profile.id,
        tg_id: userId,
        event_type: 'send_gift',
        run_at: new Date(Date.now() + 60000).toISOString()
      })
    }

    // Final choice
    else if (data.startsWith('quiz_final_')) {
      const type = data.replace('quiz_final_', '')
      await supabase.from('profiles').update({ bot_quiz_step: 5 }).eq('id', profile.id)
      await bot.editMessageReplyMarkup({ chatId, messageId: cb.message.message_id })

      if (type === 'hard' || type === 'soft') {
        const url = type === 'hard' 
          ? 'https://t.me/evapatrakhina?text=Пробой!'
          : 'https://t.me/evapatrakhina?text=Пирамида%20Потенциала'
        
        await supabase.from('profiles').update({ contact_author_clicked: true }).eq('id', profile.id)
        await bot.sendMessage({
          chatId,
          text: TEXTS.bot.afterFinalHard,
          replyMarkup: { inline_keyboard: [[{ text: 'Написать Еве', url }]] }
        })
      }
    }
  }
}
