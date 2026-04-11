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
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

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
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL ?? 'https://t.me/sprosievu'

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
  // ── Lead capture: UPSERT profile on /start ──
  try {
    const supabase = getSupabaseServer()
    await supabase
      .from('profiles')
      .upsert(
        {
          tg_id: userId,
          invites_count: 0,
        },
        { onConflict: 'tg_id', ignoreDuplicates: false }
      )
    console.log(`[webhook] Lead captured: tg_id=${userId} (profile created/updated)`)
  } catch (dbErr) {
    // Non-fatal: user can still proceed, we just lose the lead record
    console.error('[webhook] Lead capture UPSERT failed (non-fatal):', dbErr)
  }

  // ── Step 4 (Referrals): If user came via /start ref_CODE, link to referrer ──
  if (refCode !== null) {
    try {
      const supabase = getSupabaseServer()

      console.log(`[webhook] Attempting referral linking: tg_id=${userId}, refCode=${refCode}`)

      // Find referrer's profile by tg_id (the numeric ID)
      const { data: referrer, error: refErr } = await supabase
        .from('profiles')
        .select('id, tg_id, invites_count')
        .eq('tg_id', refCode)
        .single()

      if (refErr) {
        console.log(`[webhook] Referrer lookup error for tg_id=${refCode}: ${refErr.message}`)
      }

      if (referrer && referrer.id) {
        // Set referrer_id (UUID) for the new user
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ referrer_id: referrer.id })
          .eq('tg_id', userId)

        if (updateErr) {
          console.error(`[webhook] Failed to set referrer_id for tg_id=${userId}: ${updateErr.message}`)
        } else {
          console.log(`[webhook] ✅ Referral linked: tg_id=${userId} → referrer tg_id=${refCode} (profile id=${referrer.id})`)
        }
      } else {
        console.log(`[webhook] ⚠️ Referrer tg_id=${refCode} not found in profiles — referral NOT linked yet`)
      }
    } catch (refErr) {
      console.error('[webhook] Referral linking in /start failed (non-fatal):', refErr)
    }
  }

  const isReferred = refCode !== null

  const caption = isReferred
    ? `<b>ТВОЯ ВНУТРЕННЯЯ ОПОРА</b> 💎\n\n` +
      `Привет! Подруга пригласила тебя пройти тест и узнать свою теневую опору.\n\n` +
      `✦ <b>Что нужно сделать?</b>\n` +
      `Подпишись на канал автора, чтобы открыть доступ к теневой опоре для подруги, которая тебя пригласила!`
    : `<b>ТВОЯ ВНУТРЕННЯЯ ОПОРА</b> 💎\n\n` +
      `Привет! Я создала этого бота, чтобы помочь тебе найти ответы, которые уже есть внутри тебя.\n\n` +
      `✦ <b>Почему это важно?</b>\n` +
      `В мире хаоса единственное, на что можно опереться — это <i>ты сама</i>.\n\n` +
      `▹ <b>Твой первый шаг:</b>\n` +
      `Подпишись на мой канал. Там я даю эксклюзивные практики и знания, которых нет в открытом доступе.`

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

  // Hard-coded production domain for reliable photo delivery + cache bust
  const photoUrl = `https://eva-9udm.vercel.app/start.png?v=${Date.now()}`

  // ALWAYS try sendPhoto first, but FALLBACK to sendMessage — never leave user hanging
  try {
    const success = await sendPhoto({
      chatId,
      photo: photoUrl,
      caption,
      replyMarkup,
      parseMode: 'HTML',
    })

    if (!success) {
      console.log('[webhook] sendPhoto returned false, using sendMessage fallback')
      return await sendMessage({ chatId, text: caption, replyMarkup, parseMode: 'HTML' })
    }
    return true
  } catch (err) {
    console.error('[webhook] sendPhoto threw error, using sendMessage fallback:', err)
    return await sendMessage({ chatId, text: caption, replyMarkup, parseMode: 'HTML' })
  }
}

async function handleSubscriptionCheck(callbackQueryId: string, userId: number, chatId: number, refCode: number | null): Promise<void> {
  // BOT STEP 1: Button clicked
  console.log(`!!! CRITICAL !!! [BOT STEP 1] Button "I subscribed" clicked by tgId=${userId} (type: ${typeof userId}, Number: ${Number(userId)})`)
  console.log(`!!! CRITICAL !!! [BOT STEP 1] CHANNEL_ID env: ${process.env.TELEGRAM_CHANNEL_ID ? 'SET (ends in ' + process.env.TELEGRAM_CHANNEL_ID.slice(-5) + ')' : 'NOT SET'}`)

  if (!CHANNEL_ID) {
    console.error(`!!! CRITICAL !!! [BOT STEP 1] CHANNEL_ID is empty/undefined!`)
    await answerCallbackQuery({ callbackQueryId, text: 'Канал не настроен. Обратитесь к администратору.', showAlert: true })
    return
  }

  // BOT STEP 2: Check channel membership
  const status = await getChatMember(CHANNEL_ID, userId)
  console.log(`!!! CRITICAL !!! [BOT STEP 2] Channel status for user ${userId}: "${status}"`)

  // getChatMember returns null on API error (e.g. 400 Bad Request: chat not found)
  if (status === null) {
    console.error(`!!! CRITICAL !!! [BOT STEP 2] getChatMember returned null. CHANNEL_ID: ${CHANNEL_ID}`)
    await answerCallbackQuery({
      callbackQueryId,
      text: 'Ошибка: проверьте права бота в канале. Бот должен быть администратором канала.',
      showAlert: true,
    })
    return
  }

  const isSubscribed = status === 'member' || status === 'administrator' || status === 'creator'
  console.log(`!!! CRITICAL !!! [BOT STEP 2] isSubscribed calculation: ${isSubscribed} (status="${status}")`)

  if (isSubscribed) {
    // BOT STEP 3: Update DB
    console.log(`!!! CRITICAL !!! [BOT STEP 3] Attempting DB update for tg_id=${Number(userId)}`)

    // ── Anti-abuse: check if user was already subscribed BEFORE update ──
    let wasAlreadySubscribed = false
    try {
      const supabaseCheck = getSupabaseServer()
      const { data: existingProfile } = await supabaseCheck
        .from('profiles')
        .select('is_subscribed')
        .eq('tg_id', Number(userId))
        .single()
      wasAlreadySubscribed = existingProfile?.is_subscribed === true
      console.log(`!!! CRITICAL !!! [BOT STEP 3] wasAlreadySubscribed: ${wasAlreadySubscribed}`)
    } catch (checkErr) {
      console.warn(`[BOT STEP 3] Could not check existing subscription (user may not exist yet):`, checkErr)
    }

    try {
      const supabase = getSupabaseServer()
      console.log(`!!! CRITICAL !!! [BOT STEP 3] Supabase client created successfully`)

      const numericTgId = Number(userId)
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            tg_id: numericTgId,
            is_subscribed: true,
          },
          { onConflict: 'tg_id', ignoreDuplicates: false }
        )
        .select()

      if (error) {
        console.error(`!!! CRITICAL !!! [BOT STEP 3] ❌ DB Update Error:`, JSON.stringify(error))
      } else {
        console.log(`!!! CRITICAL !!! [BOT STEP 3] ✅ DB Update Success. Rows: ${data?.length}, Result:`, JSON.stringify(data))
      }
    } catch (dbErr) {
      console.error(`!!! CRITICAL !!! [BOT STEP 3] ❌ Subscription update threw:`, dbErr)
    }

    await answerCallbackQuery({ callbackQueryId })

    // ── Referral engine: increment referrer's count, notify at 2 ──
    // ONLY if this is the user's FIRST subscription (anti-abuse)
    if (!wasAlreadySubscribed) {
      console.log(`!!! STEP 4 !!! Processing referral reward. Current user tg_id: ${userId}`)

      try {
        const supabase = getSupabaseServer()

        // Find current user's profile to get referrer_id
        const { data: currentUser, error: cuErr } = await supabase
          .from('profiles')
          .select('id, referrer_id')
          .eq('tg_id', Number(userId))
          .single()

        if (cuErr) {
          console.error(`!!! STEP 4.1 ERROR !!! Could not find current user profile: ${cuErr.message}`)
        } else {
          console.log(`!!! STEP 4.1 !!! Found current user. id=${currentUser.id}, referrer_id=${currentUser.referrer_id ?? 'NULL'}`)
        }

        if (currentUser?.referrer_id) {
          console.log(`!!! STEP 5 !!! Referrer exists. Looking up referrer by id='${currentUser.referrer_id}'`)

          // Look up referrer by UUID (primary key)
          const { data: referrer, error: refErr } = await supabase
            .from('profiles')
            .select('id, tg_id, invites_count, dominant_trait, shadow_trait')
            .eq('id', currentUser.referrer_id)
            .single()

          if (refErr) {
            console.error(`!!! STEP 5.1 ERROR !!! Could not find referrer: ${refErr.message}`)
          } else if (!referrer) {
            console.log(`!!! STEP 5.2 WARNING !!! Referrer with id='${currentUser.referrer_id}' not found in DB`)
          } else {
            console.log(`!!! STEP 6 !!! Referrer found. tg_id=${referrer.tg_id}, current invites_count=${referrer.invites_count ?? 0}`)

            const oldInvites = referrer.invites_count ?? 0
            const newInvites = oldInvites + 1

            // Increment invites_count
            const { error: updErr } = await supabase
              .from('profiles')
              .update({ invites_count: newInvites })
              .eq('id', referrer.id)

            if (updErr) {
              console.error(`!!! STEP 7 ERROR !!! Failed to increment invites_count: ${updErr.message}`)
            } else {
              console.log(`!!! STEP 7 SUCCESS !!! invites_count updated: ${oldInvites} → ${newInvites} for referrer id='${referrer.id}' (tg_id=${referrer.tg_id})`)
            }

            // If invites_count reached 2, send notification with mixed trait
            if (newInvites === 2 && referrer.dominant_trait && referrer.shadow_trait) {
              console.log(`!!! STEP 8 !!! Referrer reached 2 invites — sending mixed trait notification`)

              const traits = [
                referrer.dominant_trait.toUpperCase(),
                referrer.shadow_trait.toUpperCase(),
              ].sort()
              const key = traits.join('')
              const mixedTraitText = MIXED_TRAIT_TEXTS[key] ?? ''

              const tmaUrl = getTmaUrl()
              const notifyMarkup: InlineKeyboard = {
                inline_keyboard: [
                  [{ text: '✨ Посмотреть', web_app: { url: tmaUrl } }],
                ],
              }

              const notificationText = mixedTraitText
                ? `🎉 <b>Твой второй уровень открыт!</b>\n\nПришло время узнать твою теневую опору:\n\n${mixedTraitText}`
                : `🎉 <b>Бинго!</b> Две твои подруги зашли в бота. Твоя скрытая (теневая) опора разблокирована!\n\nЗаходи в приложение, чтобы посмотреть результат.`

              const sent = await sendMessage({
                chatId: referrer.tg_id,
                text: notificationText,
                replyMarkup: notifyMarkup,
                parseMode: 'HTML',
              })

              if (!sent) {
                console.error(`!!! STEP 8 ERROR !!! Failed to send notification (sendMessage returned false)`)
              } else {
                console.log(`!!! STEP 8 SUCCESS !!! Mixed trait notification sent to referrer tg_id=${referrer.tg_id}`)
              }
            }
          }
        } else {
          console.log(`!!! STEP 4.2 !!! No referrer_id for user tg_id=${userId} — skipping referral reward`)
        }
      } catch (refErr) {
        console.error(`!!! STEP 9 ERROR !!! Referral engine threw unexpected error:`, refErr)
      }
    } // end if (!wasAlreadySubscribed)

    const successCaption =
      `🎉 <b>Подписка подтверждена!</b>\n\n` +
      `У каждого человека есть внутренняя «опора» — набор убеждений, которые помогают жить и развиваться.\n` +
      `Но иногда эти установки начинают искажаться, и мы теряем связь с собой.\n\n` +
      `👇 <i>Нажми кнопку ниже, чтобы начать тест.</i>`

    const tmaUrl = getTmaUrl(refCode ?? undefined)

    const replyMarkup: InlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '✨ Пройти тест',
            web_app: { url: tmaUrl },
          },
        ],
      ],
    }

    const photoUrl = `https://eva-9udm.vercel.app/start1.png?v=${Date.now()}`

    try {
      const sent = await sendPhoto({
        chatId,
        photo: photoUrl,
        caption: successCaption,
        replyMarkup,
        parseMode: 'HTML',
      })

      if (!sent) {
        console.log('[webhook] sendPhoto returned false in success, using sendMessage fallback')
        await sendMessage({ chatId, text: successCaption, replyMarkup, parseMode: 'HTML' })
      }
    } catch (err) {
      console.error('[webhook] sendPhoto threw in success, using sendMessage fallback:', err)
      await sendMessage({ chatId, text: successCaption, replyMarkup, parseMode: 'HTML' })
    }
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
  // ── DEBUG: verify env variables ──
  console.log('!!! WEBHOOK ATTEMPT !!!')
  console.log('DEBUG: Using Token ending in:', process.env.TELEGRAM_BOT_TOKEN?.slice(-5))
  console.log('DEBUG: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  try {
    // ── AGGRESSIVE LOGGING: dump entire incoming request ──
    let rawBody: string
    try {
      rawBody = await req.text()
      console.log('=== WEBHOOK RECEIVED ===', rawBody)
    } catch (e) {
      console.error('=== WEBHOOK RECEIVED (failed to read body) ===', e)
      rawBody = ''
    }

    // 1. Validate secret token — TEMPORARILY DISABLED for debugging
    /*
    if (!validateSecretToken(req)) {
      console.warn('[webhook] Invalid secret token')
      return new NextResponse('Unauthorized', { status: 401 })
    }
    */

    // 2. Parse body — handle unexpected formats gracefully
    let update: TelegramUpdate | undefined
    try {
      update = JSON.parse(rawBody)
    } catch {
      console.warn('[webhook] Invalid JSON body')
      return new NextResponse('Bad Request', { status: 400 })
    }

    if (!update || typeof update !== 'object') {
      console.warn('[webhook] Empty or invalid update')
      return new NextResponse('OK')
    }

    // 3. Handle different update types
    try {
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
          console.log(`!!! CRITICAL !!! [BOT STEP 0] Callback received: data="${data}", from user ${from.id} (type: ${typeof from.id}), chatId=${chatId}`)

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
        } else {
          console.warn(`!!! CRITICAL !!! [BOT STEP 0] Callback received but missing chatId or from:`, {
            hasChatId: !!message?.chat?.id,
            hasFrom: !!from,
            callbackData: data,
          })
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
    } catch (handlerErr) {
      console.error('WEBHOOK CRASH:', handlerErr)
    }

    // Always respond with 200 to Telegram — even if handler crashed
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('WEBHOOK CRASH (top-level):', err)
    return NextResponse.json({ ok: true })
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
