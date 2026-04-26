/**
 * Supabase Edge Function: process-bot-queue
 * Обрабатывает очередь отложенных задач для Telegram бота.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://eva-app.vercel.app'
const GIFT_VIDEO_FILE_ID = Deno.env.get('GIFT_VIDEO_FILE_ID')

const dbHeaders = {
  'apikey': SUPABASE_KEY!,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function tgApi(method: string, body: any): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[Telegram Error] ${method} to ${body.chat_id}:`, err)
  }
  return res.ok
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<boolean> {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (replyMarkup) body.reply_markup = replyMarkup
  return tgApi('sendMessage', body)
}

async function sendVideo(chatId: number, video: string, protectContent = true): Promise<boolean> {
  return tgApi('sendVideo', { chat_id: chatId, video, protect_content: protectContent })
}

async function dbGet(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: dbHeaders })
  return res.json()
}

async function dbPatch(path: string, body: any): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: dbHeaders,
    body: JSON.stringify(body)
  })
}

serve(async (_req: Request) => {
  try {
    const now = new Date().toISOString()
    console.log(`[bot-queue] Checking for pending tasks at ${now}`)

    const tasks = await dbGet(
      `bot_tasks_queue?status=eq.pending&run_at=lte.${now}&order=run_at.asc&limit=50`
    )
    console.log(`[bot-queue] Found ${tasks.length} tasks to process.`)

    let processed = 0

    for (const task of tasks) {
      try {
        console.log(`[bot-queue] Processing task ${task.id} (type: ${task.event_type})`)

        await dbPatch(`bot_tasks_queue?id=eq.${task.id}`, { status: 'processing', updated_at: now })

        let success = false

        // ── start_qualification ─────────────────────────────────────────
        if (task.event_type === 'start_qualification') {
          const profiles = await dbGet(`profiles?id=eq.${task.profile_id}&select=bot_quiz_step`)
          const quizStep = profiles?.[0]?.bot_quiz_step ?? 0

          if (quizStep >= 1) {
            console.log(`[bot-queue] start_qualification: skipping, step already ${quizStep}`)
            success = true
          } else {
            const intro1 = 'Ты уже заметила, как искажённая опора влияет на твою жизнь?\n\nДавай ещё немного пообщаемся! Ответь на три простых вопроса и получи подарок.'
            const intro2 = 'Ты увидела механизм. И, скорее всего, это не первый раз, когда ты что-то про себя понимаешь.\n\nВопрос в другом: почему это до сих пор не меняет твою жизнь?\n\nПотому что понимание не демонтирует паттерн. Это делается только через работу.'
            const q1Text = '<b>В какой сфере сильнее чувствуется напряжение?</b>'
            const q1Keyboard = {
              inline_keyboard: [
                [{ text: 'Деньги', callback_data: 'quiz_q1_money' }],
                [{ text: 'Отношения', callback_data: 'quiz_q1_relations' }],
                [{ text: 'Здоровье', callback_data: 'quiz_q1_health' }],
                [{ text: 'Другое', callback_data: 'quiz_q1_other' }],
                [{ text: 'Везде', callback_data: 'quiz_q1_everywhere' }],
              ]
            }

            await sendMessage(task.tg_id, intro1)
            await sendMessage(task.tg_id, intro2)
            success = await sendMessage(task.tg_id, q1Text, q1Keyboard)
            if (success) {
              await dbPatch(`profiles?id=eq.${task.profile_id}`, { bot_quiz_step: 1 })
            }
          }
        }

        // ── send_gift ───────────────────────────────────────────────────
        else if (task.event_type === 'send_gift') {
          if (GIFT_VIDEO_FILE_ID) {
            success = await sendVideo(task.tg_id, GIFT_VIDEO_FILE_ID)
          } else {
            success = await sendMessage(task.tg_id, '🎁 Твой подарок готов!')
          }
        }

        // ── check_referral_12h ──────────────────────────────────────────
        else if (task.event_type === 'check_referral_12h') {
          const profiles = await dbGet(`profiles?id=eq.${task.profile_id}&select=invites_count,mixed_trait_sent,tg_id`)
          const profile = profiles?.[0]

          if (!profile) {
            success = true
          } else if ((profile.invites_count ?? 0) >= 2 && !profile.mixed_trait_sent) {
            const results = await dbGet(`test_results?tg_id=eq.${profile.tg_id}&select=primary_support,secondary_support`)
            const tr = results?.[0]
            if (tr?.primary_support && tr?.secondary_support) {
              const mixedKey = [tr.primary_support.toUpperCase(), tr.secondary_support.toUpperCase()].sort().join('')
              const mixedText = getMixedTraitTexts()[mixedKey]
              if (mixedText) {
                success = await sendMessage(task.tg_id, mixedText)
                if (success) {
                  await dbPatch(`profiles?id=eq.${task.profile_id}`, {
                    mixed_trait_sent: true,
                    mixed_trait_sent_at: now
                  })
                }
              } else {
                success = true
              }
            } else {
              success = true
            }
          } else if ((profile.invites_count ?? 0) < 2) {
            success = await sendMessage(task.tg_id, 'Вижу, твои друзья ещё не прошли тест. Попробуем им напомнить?')
          } else {
            success = true
          }
        }

        // ── cooldown_reminder ───────────────────────────────────────────
        else if (task.event_type === 'cooldown_reminder') {
          const profiles = await dbGet(`profiles?id=eq.${task.profile_id}&select=reminded_at`)
          const profile = profiles?.[0]

          if (profile?.reminded_at) {
            success = true
          } else {
            const keyboard = {
              inline_keyboard: [[{ text: '✨ Пройти тест', web_app: { url: APP_URL } }]]
            }
            success = await sendMessage(task.tg_id, 'Хорошая новость!\n\nДоступ к тесту снова открыт. Заходи и проверь динамику своих изменений.', keyboard)
            if (success) {
              await dbPatch(`profiles?id=eq.${task.profile_id}`, { reminded_at: now })
            }
          }
        }

        if (success) {
          await dbPatch(`bot_tasks_queue?id=eq.${task.id}`, { status: 'processed', updated_at: now })
          processed++
        } else {
          throw new Error('Action failed')
        }

      } catch (err) {
        console.error(`[bot-queue] Task ${task.id} failed:`, err)
        await dbPatch(`bot_tasks_queue?id=eq.${task.id}`, {
          status: 'failed',
          error_message: String(err),
          updated_at: now
        })
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[bot-queue] Global Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

function getMixedTraitTexts(): Record<string, string> {
  return {
    SU: `<b>«Тихий тащитель»</b>\n\nТы тащишь.\nИ делаешь это тихо.\nТы справляешься.\nНе просишь помощи.\nИ при этом стараешься быть удобной.\n\nНо внутри:\n— усталость\n— одиночество\n— ощущение, что тебя не видят\n\nТы отдаёшь много.\nНо это не возвращается.\n\nЦена:\nТы исчезаешь из своей же жизни.\n\n⚡️ Внутри звучит:\n«Я всё делаю правильно… почему меня не выбирают?»`,
    PS: `<b>«Машина результата»</b>\n\nТы работаешь на максимум.\nСильная. Эффективная. Идеальная.\nТы не позволяешь себе слабость.\nИ не позволяешь ошибаться.\n\nНо внутри:\n— выгорание\n— пустота\n— отрезанность от себя\n\nТы как система.\nНо не как живая.\n\nЦена:\nТы теряешь себя ради результата.\n\n⚡️ Внутри звучит:\n«Я должна быть сверхчеловеком»`,
    RS: `<b>«Опора для всех»</b>\n\nТы держишь не только себя — ты держишь всех.\nТы чувствуешь других.\nРегулируешь. Поддерживаешь.\n\nНо внутри:\n— перегруз\n— усталость\n— ощущение «слишком много на мне»\n\nТы несёшь больше, чем можешь.\n\nЦена:\nТы живёшь чужими жизнями вместо своей.\n\n⚡️ Внутри звучит:\n«Без меня всё развалится»`,
    KS: `<b>«Железная система»</b>\n\nТы сильная и всё контролируешь.\nТы держишь. Просчитываешь.\nНе даёшь себе расслабиться.\n\nНо внутри:\n— жёсткость\n— тревога\n— напряжение\n\nТы как будто всегда «на посту».\n\nЦена:\nТы не живёшь — ты управляешь выживанием.\n\n⚡️ Внутри звучит:\n«Я должна удержать всё любой ценой»`,
    PU: `<b>«Идеальная для всех»</b>\n\nТы стараешься быть идеальной, чтобы тебя любили.\nТы подстраиваешься.\nСоответствуешь. Стараешься.\n\nНо внутри:\n— стыд\n— страх «недостаточности»\n— зависимость от оценки\n\nТы не можешь быть собой.\n\nЦена:\nТы живёшь чужими ожиданиями.\n\n⚡️ Внутри звучит:\n«Если я не идеальна — меня не выберут»`,
    RU: `<b>«Спасатель»</b>\n\nТы живёшь через помощь другим.\nТы включаешься.\nСпасаешь. Поддерживаешь.\n\nНо внутри:\n— истощение\n— пустота\n— ощущение, что тебя нет\n\nТы отдаёшь себя, чтобы быть нужной.\n\nЦена:\nТы теряешь контакт с собой.\n\n⚡️ Внутри звучит:\n«Я нужна, только если я полезна»`,
    KU: `<b>«Тревожный угодник»</b>\n\nТы стараешься угадать, как правильно.\nТы анализируешь реакции.\nПодстраиваешься. Контролируешь.\n\nНо внутри:\n— тревога\n— напряжение\n— страх ошибиться\n\nТы живёшь в режиме «не так сделать нельзя».\n\nЦена:\nТы теряешь свободу и спонтанность.\n\n⚡️ Внутри звучит:\n«Если я ошибусь — меня отвергнут»`,
    PR: `<b>«Социальный идеал»</b>\n\nТы пытаешься быть идеальной для всех.\nТы чувствуешь ожидания.\nИ стараешься им соответствовать.\n\nНо внутри:\n— перегруз\n— потеря себя\n— тревога\n\nТы разрываешься между «как надо».\n\nЦена:\nТы не знаешь, какая ты настоящая.\n\n⚡️ Внутри звучит:\n«Я должна соответствовать всем»`,
    KP: `<b>«Тревожный достигатор»</b>\n\nТы живёшь через контроль и идеальность.\nТы стараешься предусмотреть всё.\nНе ошибаться. Быть на высоте.\n\nНо внутри:\n— напряжение\n— тревога\n— страх провала\n\nТы не можешь выдохнуть.\n\nЦена:\nТы живёшь в постоянном напряжении «а вдруг что-то не так».\n\n⚡️ Внутри звучит:\n«Ошибка — это катастрофа»`,
    KR: `<b>«Сканер угроз»</b>\n\nТы постоянно на чеку.\nТы чувствуешь всё.\nИ пытаешься предотвратить плохое.\n\nНо внутри:\n— перегруз\n— тревога\n— усталость\n\nТы не расслабляешься вообще.\n\nЦена:\nТы живёшь в режиме постоянной опасности.\n\n⚡️ Внутри звучит:\n«Я должна всё предусмотреть, иначе будет плохо»`,
  }
}
