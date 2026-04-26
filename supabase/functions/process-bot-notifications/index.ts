/**
 * Supabase Edge Function: process-bot-notifications
 * Обрабатывает вебхуки Supabase: INSERT/UPDATE test_results и UPDATE profiles.
 * СТРОГО ПО TEXTS.md и LOGIC.md
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://eva-app.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const TRAIT_IMAGES: Record<string, string> = {
  S: `${APP_URL}/hero.png`,
  U: `${APP_URL}/pleaser.png`,
  P: `${APP_URL}/perfectionist.png`,
  R: `${APP_URL}/stayer.png`,
  K: `${APP_URL}/controller.png`,
}

const DOMINANT_TRAIT_TEXTS: Record<string, string> = {
  S: `<b>ГЕРОИЧЕСКАЯ ОПОРА</b>\n\nТы та, кто держит.\nДаже когда тяжело. Даже когда уже нет сил.\nТы не позволяешь себе развалиться.\nНе просишь помощи.\nСобираешься и идёшь дальше.\n\nНо внутри:\n— постоянное напряжение\n— одиночество\n— ощущение, что всё на тебе\n\nТы привыкла быть сильной.\nНастолько, что уже не знаешь, как по-другому.\n\nЦена:\nТы живёшь на износе.\nИ даже не разрешаешь себе это признать.\n\n⚡️ Внутри звучит:\n«Если я перестану держать — меня не станет»`,
  U: `<b>ПОДСТРАИВАЮЩАЯСЯ ОПОРА</b>\n\nТы умеешь быть удобной.\nЧувствовать других. Подстраиваться.\nТы сглаживаешь углы.\nИзбегаешь конфликтов.\nЧасто выбираешь не себя.\n\nНо внутри:\n— подавленные желания\n— злость, которую нельзя проявить\n— страх быть отвергнутой\n\nТы стараешься быть хорошей.\nНо это не даёт тебе того, что ты хочешь.\n\nЦена:\nТы теряешь себя, чтобы сохранить отношения.\n\n⚡️ Внутри звучит:\n«Если я буду собой — меня не выберут»`,
  P: `<b>ПЕРФЕКЦИОНИРУЮЩАЯ ОПОРА</b>\n\nТы живёшь через результат.\nЧерез «сделать правильно».\nТы стараешься быть идеальной.\nНе ошибаться.\nДержать уровень.\n\nНо внутри:\n— страх критики\n— напряжение\n— ощущение, что ты недостаточно хороша\n\nТы всё время доказываешь свою ценность.\nДаже когда уже доказала.\n\nЦена:\nТы не можешь расслабиться.\nПотому что всегда есть «ещё лучше».\n\n⚡️ Внутри звучит:\n«Если я не идеальна — я ничто»`,
  R: `<b>УДЕРЖИВАЮЩАЯ ОПОРА</b>\n\nТы чувствуешь всё.\nАтмосферу, людей, напряжение.\nТы сглаживаешь конфликты.\nПоддерживаешь.\nДержишь «поле».\n\nНо внутри:\n— перегруз\n— тревожность\n— ощущение, что слишком много на тебе\n\nТы живёшь через других.\nИ почти не остаётся места для себя.\n\nЦена:\nТы выгораешь, удерживая то, что не обязана держать.\n\n⚡️ Внутри звучит:\n«Если я отпущу — всё развалится»`,
  K: `<b>КОНТРОЛИРУЮЩАЯ ОПОРА</b>\n\nТы стараешься всё предусмотреть.\nДержать под контролем.\nТы анализируешь, планируешь, просчитываешь.\nНе любишь неопределённость.\n\nНо внутри:\n— тревога\n— напряжение\n— ощущение угрозы\n\nТы не расслабляешься.\nПотому что «вдруг что-то пойдёт не так».\n\nЦена:\nТы живёшь в постоянной готовности к опасности.\n\n⚡️ Внутри звучит:\n«Если я не контролирую — я в опасности»`,
}

const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU: `<b>«Тихий тащитель»</b>\n\nТы тащишь.\nИ делаешь это тихо.\nТы справляешься.\nНе просишь помощи.\nИ при этом стараешься быть удобной.\n\nНо внутри:\n— усталость\n— одиночество\n— ощущение, что тебя не видят\n\nТы отдаёшь много.\nНо это не возвращается.\n\nЦена:\nТы исчезаешь из своей же жизни.\n\n⚡️ Внутри звучит:\n«Я всё делаю правильно… почему меня не выбирают?»`,
  PS: `<b>«Машина результата»</b>\n\nТы работаешь на максимум.\nСильная. Эффективная. Идеальная.\nТы не позволяешь себе слабость.\nИ не позволяешь ошибаться.\n\nНо внутри:\n— выгорание\n— пустота\n— отрезанность от себя\n\nТы как система.\nНо не как живая.\n\nЦена:\nТы теряешь себя ради результата.\n\n⚡️ Внутри звучит:\n«Я должна быть сверхчеловеком»`,
  RS: `<b>«Опора для всех»</b>\n\nТы держишь не только себя — ты держишь всех.\nТы чувствуешь других.\nРегулируешь. Поддерживаешь.\n\nНо внутри:\n— перегруз\n— усталость\n— ощущение «слишком много на мне»\n\nТы несёшь больше, чем можешь.\n\nЦена:\nТы живёшь чужими жизнями вместо своей.\n\n⚡️ Внутри звучит:\n«Без меня всё развалится»`,
  KS: `<b>«Железная система»</b>\n\nТы сильная и всё контролируешь.\nТы держишь. Просчитываешь.\nНе даёшь себе расслабиться.\n\nНо внутри:\n— жёсткость\n— тревога\n— напряжение\n\nТы как будто всегда «на посту».\n\nЦена:\nТы не живёшь — ты управляешь выживанием.\n\n⚡️ Внутри звучит:\n«Я должна удержать всё любой ценой»`,
  PU: `<b>«Идеальная для всех»</b>\n\nТы стараешься быть идеальной, чтобы тебя любили.\nТы подстраиваешься.\nСоответствуешь. Стараешься.\n\nНо внутри:\n— стыд\n— страх «недостаточности»\n— зависимость от оценки\n\nТы не можешь быть собой.\n\nЦена:\nТы живёшь чужими ожиданиями.\n\n⚡️ Внутри звучит:\n«Если я не идеальна — меня не выберут»`,
  RU: `<b>«Спасатель»</b>\n\nТы живёшь через помощь другим.\nТы включаешься.\nСпасаешь. Поддерживаешь.\n\nНо внутри:\n— истощение\n— пустота\n— ощущение, что тебя нет\n\nТы отдаёшь себя, чтобы быть нужной.\n\nЦена:\nТы теряешь контакт с собой.\n\n⚡️ Внутри звучит:\n«Я нужна, только если я полезна»`,
  KU: `<b>«Тревожный угодник»</b>\n\nТы стараешься угадать, как правильно.\nТы анализируешь реакции.\nПодстраиваешься. Контролируешь.\n\nНо внутри:\n— тревога\n— напряжение\n— страх ошибиться\n\nТы живёшь в режиме «не так сделать нельзя».\n\nЦена:\nТы теряешь свободу и спонтанность.\n\n⚡️ Внутри звучит:\n«Если я ошибусь — меня отвергнут»`,
  PR: `<b>«Социальный идеал»</b>\n\nТы пытаешься быть идеальной для всех.\nТы чувствуешь ожидания.\nИ стараешься им соответствовать.\n\nНо внутри:\n— перегруз\n— потеря себя\n— тревога\n\nТы разрываешься между «как надо».\n\nЦена:\nТы не знаешь, какая ты настоящая.\n\n⚡️ Внутри звучит:\n«Я должна соответствовать всем»`,
  KP: `<b>«Тревожный достигатор»</b>\n\nТы живёшь через контроль и идеальность.\nТы стараешься предусмотреть всё.\nНе ошибаться. Быть на высоте.\n\nНо внутри:\n— напряжение\n— тревога\n— страх провала\n\nТы не можешь выдохнуть.\n\nЦена:\nТы живёшь в постоянной готовности к опасности.\n\n⚡️ Внутри звучит: «Ошибка — это катастрофа»`,
  KR: `<b>«Сканер угроз»</b>\n\nТы постоянно на чеку.\nТы чувствуешь всё.\nИ пытаешься предотвратить плохое.\n\nНо внутри:\n— перегруз\n— тревога\n— усталость\n\nТы не расслабляешься вообще.\n\nЦена:\nТы живёшь в режиме постоянной опасности.\n\n⚡️ Внутри звучит:\n«Я должна всё предусмотреть, иначе будет плохо»`,
}

async function tgApi(method: string, body: any): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[Telegram API Error] ${method}:`, err)
  }
  return res.ok
}

async function sendPhoto(chatId: number, photo: string, caption?: string): Promise<boolean> {
  return tgApi('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML' })
}

async function sendMessage(chatId: number, text: string): Promise<boolean> {
  return tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' })
}

serve(async (req: Request) => {
  try {
    const payload = await req.json()
    console.log(`[Notification Engine] Event: ${payload.type}, Table: ${payload.table}`)

    // 1. Уведомление о прохождении теста (Dominant Trait)
    if (payload.table === 'test_results' && (payload.type === 'INSERT' || payload.type === 'UPDATE')) {
      const record = payload.record
      const tgId = record.tg_id

      if (tgId) {
        const trait = (record.primary_support || '').toUpperCase()
        const imageUrl = TRAIT_IMAGES[trait] || TRAIT_IMAGES['S']
        const text = DOMINANT_TRAIT_TEXTS[trait] || `Ваша опора: ${trait}`

        console.log(`[Notification Engine] Sending result for ${tgId}, trait: ${trait}`)
        const success = await sendPhoto(tgId, imageUrl, text)
        if (!success) {
          await sendMessage(tgId, text)
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // 2. Уведомление о второй опоре (Mixed Trait)
    if (payload.table === 'profiles' && payload.type === 'UPDATE') {
      const record = payload.record
      const oldRecord = payload.old_record

      // Проверяем условие: инвайтов стало 2, и мы еще не отправляли смешанную опору
      if (record.invites_count >= 2 && (oldRecord?.invites_count ?? 0) < 2 && !record.mixed_trait_sent) {
        console.log(`[Notification Engine] Invites reached 2 for ${record.tg_id}. Fetching results...`)
        
        const fetchRes = await fetch(
          `${SUPABASE_URL}/rest/v1/test_results?tg_id=eq.${record.tg_id}&select=primary_support,secondary_support`,
          {
            headers: {
              'apikey': SUPABASE_KEY!,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            }
          }
        )
        const results = await fetchRes.json()

        const tr = results?.[0]
        if (tr?.primary_support && tr?.secondary_support) {
          const mixedKey = [tr.primary_support.toUpperCase(), tr.secondary_support.toUpperCase()].sort().join('')
          const mixedText = MIXED_TRAIT_TEXTS[mixedKey]
          
          if (mixedText) {
            console.log(`[Notification Engine] Sending mixed trait ${mixedKey} to ${record.tg_id}`)
            const sent = await sendMessage(record.tg_id, mixedText)
            if (sent) {
              // Помечаем как отправленное
              await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${record.id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_KEY!,
                  'Authorization': `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  mixed_trait_sent: true,
                  mixed_trait_sent_at: new Date().toISOString()
                })
              })
            }
          }
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 })
  } catch (err: any) {
    console.error('[Notification Engine] Global Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
