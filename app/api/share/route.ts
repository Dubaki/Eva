import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMessage } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey)

  try {
    const { tgId, trait, link: providedLink } = await request.json()

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Missing tgId' }, { status: 400 })
    }

    // 1. Get profile (Armor: limit(1) prevents 500 error on duplicates)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, tg_id, shared_at')
      .eq('tg_id', tgId)
      .limit(1)

    const profile = profiles?.[0]

    if (profileError || !profile) {
      console.error('[api/share] Profile not found:', tgId)
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // 2. Logic: If shared_at is NULL, send messages
    if (!profile.shared_at) {
      console.log(`[api/share] First share for tgId ${tgId}. Sending instructions.`)
      
      // Validate provided link or fallback to generating it
      let referralLink = providedLink
      if (!referralLink || !referralLink.startsWith('https://t.me/') || !referralLink.includes(`ref_${tgId}`)) {
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'sprosievubot'
        referralLink = `https://t.me/${botUsername}?start=ref_${tgId}`
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
