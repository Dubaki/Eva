import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMessage } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'

const DOMINANT_TRAIT_TEXTS: Record<string, string> = {
  S: `<b>ГЕРОИЧЕСКАЯ ОПОРА</b>

Ты та, кто держит.
Даже когда тяжело. Даже когда уже нет сил.
Ты не позволяешь себе развалиться.
Не просишь помощи.
Собираешься и идёшь дальше.

Но внутри:
— постоянное напряжение
— одиночество
— ощущение, что всё на тебе

Ты привыкла быть сильной.
Настолько, что уже не знаешь, как по-другому.

Цена:
Ты живёшь на износе.
И даже не разрешаешь себе это признать.

⚡️ Внутри звучит:
«Если я перестану держать — меня не станет»`,

  U: `<b>ПОДСТРАИВАЮЩАЯСЯ ОПОРА</b>

Ты умеешь быть удобной.
Чувствовать других. Подстраиваться.
Ты сглаживаешь углы.
Избегаешь конфликтов.
Часто выбираешь не себя.

Но внутри:
— подавленные желания
— злость, которую нельзя проявить
— страх быть отвергнутой

Ты стараешься быть хорошей.
Но это не даёт тебе того, что ты хочешь.

Цена:
Ты теряешь себя, чтобы сохранить отношения.

⚡️ Внутри звучит:
«Если я буду собой — меня не выберут»`,

  P: `<b>ПЕРФЕКЦИОНИРУЮЩАЯ ОПОРА</b>

Ты живёшь через результат.
Через «сделать правильно»
Ты стараешься быть идеальной.
Не ошибаться.
Держать уровень.

Но внутри:
— страх критики
— напряжение
— ощущение, что ты недостаточно хороша

Ты всё время доказываешь свою ценность.
Даже когда уже доказала.

Цена:
Ты не можешь расслабиться.
Потому что всегда есть «ещё лучше».

⚡️ Внутри звучит:
«Если я не идеальна — я ничто»`,

  R: `<b>УДЕРЖИВАЮЩАЯ ОПОРА</b>

Ты чувствуешь всё.
Атмосферу, людей, напряжение.
Ты сглаживаешь конфликты.
Поддерживаешь.
Держишь «поле».

Но внутри:
— перегруз
— тревожность
— ощущение, что слишком много на тебе

Ты живёшь через других.
И почти не остаётся места для себя.

Цена:
Ты выгораешь, удерживая то, что не обязана держать.

⚡️ Внутри звучит:
«Если я отпущу — всё развалится»`,

  K: `<b>КОНТРОЛИРУЮЩАЯ ОПОРА</b>

Ты стараешься всё предусмотреть.
Держать под контролем.
Ты анализируешь, планируешь, просчитываешь.
Не любишь неопределённость.

Но внутри:
— тревога
— напряжение
— ощущение угрозы

Ты не расслабляешься.
Потому что «вдруг что-то пойдёт не так».

Цена:
Ты живёшь в постоянной готовности к опасности.

⚡️ Внутри звучит:
«Если я не контролирую — я в опасности»`,
}

export async function POST(request: NextRequest) {
  const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey)

  try {
    const { tgId, trait } = await request.json()

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Missing tgId' }, { status: 400 })
    }

    // 1. Get profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, tg_id, shared_at')
      .eq('tg_id', tgId)
      .single()

    if (profileError || !profile) {
      console.error('[api/share] Profile not found:', tgId)
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // 2. Logic: If shared_at is NULL, send messages
    if (!profile.shared_at) {
      console.log(`[api/share] First share for tgId ${tgId}. Sending instructions and result.`)
      
      const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'eva_test_bot'
      const referralLink = `https://t.me/${botUsername}?start=ref_${tgId}`

      // Message 0: The result (if trait is provided)
      if (trait && DOMINANT_TRAIT_TEXTS[trait]) {
        await sendMessage({
          chatId: tgId,
          text: DOMINANT_TRAIT_TEXTS[trait],
        })
      }

      // Message 1: Instruction
      await sendMessage({
        chatId: tgId,
        text: 'Скопируй сообщение ниже и отправь его двум друзьям. Когда твои друзья пройдут тест, тебе придёт ответ',
      })

      // Message 2: Shareable text
      await sendMessage({
        chatId: tgId,
        text: `Пройди этот тест и узнай, какой механизм снова и снова приводит тебя к одним и тем же проблемам\n\n${referralLink}`,
      })

      // Update shared_at
      await supabaseAdmin
        .from('profiles')
        .update({ shared_at: new Date().toISOString() })
        .eq('id', profile.id)
    } else {
      console.log(`[api/share] User ${tgId} already shared at ${profile.shared_at}. Skipping messages.`)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/share] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
