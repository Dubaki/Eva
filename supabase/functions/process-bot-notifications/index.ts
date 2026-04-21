/**
 * Supabase Edge Function: process-bot-notifications
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || 'https://eva-app.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const MIXED_TRAIT_TEXTS: Record<string, string> = {
  SU: `S + U — «Тихий тащитель»\n\nТы тащишь.\nИ делаешь это тихо.\nТы справляешься.\nНе просишь помощи.\nИ при этом стараешься быть удобной.\n\nНо внутри:\n— усталость\n— одиночество\n— ощущение, что тебя не видят\n\nТы отдаёшь много.\nНо это не возвращается.\n\nЦена:\nТы исчезаешь из своей же жизни.\n\n⚡️ Внутри звучит:\n«Я всё делаю правильно… почему меня не выбирают?»`,
  SP: `S + P — «Машина результата»\n\nТы работаешь на максимум.\nСильная. Эффективная. Идеальная.\nТы не позволяешь себе слабость.\nИ не позволяешь ошибаться.\n\nНо внутри:\n— выгорание\n— пустота\n— отрезанность от себя\n\nТы как система.\nНо не как живая.\n\nЦена:\nТы теряешь себя ради результата.\n\n⚡️ Внутри звучит:\n«Я должна быть сверхчеловеком»`,
  RS: `S + R — «Опора для всех»\n\nТы держишь не только себя — ты држишь всех.\nТы чувствуешь других.\nРегулируешь. Поддерживаешь.\n\nНо внутри:\n— перегруз\n— усталость\n— ощущение «слишком много на мне»\n\nТы несёшь больше, чем можешь.\n\nЦена:\nТы живёшь чужими жизнями вместо своей.\n\n⚡️ Внутри звучит:\n«Без меня всё развалится»`,
  KS: `S + K — «Железная система»\n\nТы сильная и всё контролируешь.\nТы держишь. Просчитываешь.\nНе даёшь себе расслабиться.\n\nНо внутри:\n— жёсткость\n— тревога\n— напряжение\n\nТы как будто всегда «на посту».\n\nЦена:\nТы не живёшь — ты управляешь выживанием.\n\n⚡️ Внутри звучит:\n«Я должна удержать всё любой ценой»`,
  PU: `U + P — «Идеальная для всех»\n\nТы стараешься быть идеальной, чтобы тебя любили.\nТы подстраиваешься.\nСоответствуешь. Стараешься.\n\nНо внутри:\n— стыд\n— страх «недостаточности»\n— зависимость от оценки\n\nТы не можешь быть собой.\n\nЦена:\nТы живёшь чужими ожиданиями.\n\n⚡️ Внутри звучит:\n«Если я не идеальна — меня не выберут»`,
  RU: `U + R — «Спасатель»\n\nТы живёшь через помощь другим.\nТы включаешься.\nСпасаешь. Поддерживаешь.\n\nНо внутри:\n— истощение\n— пустота\n— ощущение, что тебя нет\n\nТы отдаёшь себя, чтобы быть нужной.\n\nЦена:\nТы теряешь контакт с собой.\n\n⚡️ Внутри звучит:\n«Я нужна, только если я полезна»`,
  KU: `U + K — «Тревожный угодник»\n\nТы стараешься угадать, как правильно.\nТы анализируешь реакции.\nПодстраиваешься. Контролируешь.\n\nНо внутри:\n— тревога\n— напряжение\n— страх ошибиться\n\nТы живёшь в режиме «не так сделать нельзя».\n\nЦена:\nТы теряешь свободу и спонтанность.\n\n⚡️ Внутри звучит:\n«Если я ошибусь — меня отвергнут»`,
  PR: `P + R — «Социальный идеал»\n\nТы пытаешься быть идеальной для всех.\nТы чувствуешь ожидания.\nИ стараешься им соответствовать.\n\nНо внутри:\n— перегруз\n— потеря себя\n— тревога\n\nТы разрываешься между «как надо».\n\nЦена:\nТы не знаешь, какая ты настоящая.\n\n⚡️ Внутри звучит:\n«Я должна соответствовать всем»`,
  KP: `P + K — «Тревожный достигатор»\n\nТы живёшь через контроль и идеальность.\nТы стараешься предусмотреть всё.\nНе ошибаться. Быть на высоте.\n\nНо внутри:\n— напряжение\n— тревога\n— страх провала\n\nТы не можешь выдохнуть.\n\nЦена:\nТы живёшь в постоянном напряжении «а вдруг что-то не так».\n\n⚡️ Внутри звучит:\n«Ошибка — это катастрофа»`,
  KR: `R + K — «Сканер угроз»\n\nТы постоянно на чеку.\nТы чувствуешь всё.\nИ пытаешься предотвратить плохое.\n\nНо внутри:\n— перегруз\n— тревога\n— усталость\n\nТы не расслабляешься вообще.\n\nЦена:\nТы живёшь в режиме постоянной опасности.\n\n⚡️ Внутри звучит:\n«Я должна всё предусмотреть, иначе будет плохо»`,
}

async function api(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

async function sendMessage(chatId: number, text: string) {
  return api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' })
}

async function db(path: string, method = 'GET', body?: any) {
  const options: any = {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }
  if (method !== 'GET') {
    options.method = method
    options.body = JSON.stringify(body)
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, options)
  return res.json()
}

serve(async (req: Request) => {
  try {
    const payload = await req.json()
    
    // 1. Direct Milestone Event
    if (payload.event === 'referrals_reached_2') {
      const text = MIXED_TRAIT_TEXTS[payload.mixed_trait]
      if (text) {
        await sendMessage(payload.tg_id, `<b>🎉 Поздравляем! По твоей ссылке 2 человека прошли тест.</b>\n\nТебе открылась твоя «Вторая опора»:\n\n${text}`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // 2. Database Webhook — profiles UPDATE
    if (payload.table === 'profiles' && payload.type === 'UPDATE') {
      const record = payload.record
      const oldRecord = payload.old_record
      
      if (record.invites_count === 2 && oldRecord?.invites_count !== 2) {
        // ИСПРАВЛЕНО: Используем primary_support и secondary_support согласно Скриншоту 2.jpg
        const results = await db(`test_results?profile_id=eq.${record.id}&select=primary_support,secondary_support`)
        const tr = results?.[0]
        
        if (tr?.primary_support && tr?.secondary_support) {
          const mixedKey = [tr.primary_support.toUpperCase(), tr.secondary_support.toUpperCase()].sort().join('')
          const mixedText = MIXED_TRAIT_TEXTS[mixedKey]
          
          if (mixedText) {
            await sendMessage(record.tg_id, `<b>🎉 Поздравляем! По твоей ссылке 2 человека прошли тест.</b>\n\nТебе открылась твоя «Вторая опора»:\n\n${mixedText}`)
          }
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
