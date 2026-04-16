import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getChatMember } from '@/lib/telegram-bot'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'
import { sendMessage } from '@/lib/telegram-bot'
import { verifyJwt } from '@/lib/jwt'

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID

/**
 * POST /api/subscription/confirm
 */
export async function POST(req: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    // ── 1. JWT Authentication ──
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = verifyJwt(token, jwtSecret)
    if (!payload || !payload.sub) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const profileId = payload.sub

    // ── 2. Get User Info from DB ──
    const supabase = getSupabaseServer()
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, tg_id, is_subscribed')
      .eq('id', profileId)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const tgId = profile.tg_id
    const wasAlreadySubscribed = profile.is_subscribed === true

    // ── 3. Check Body for Inviter ──
    let body: any = {}
    try {
      body = await req.json()
    } catch (e) { /* ignore empty body */ }
    
    const inviterTgId: number | null = body?.inviterTgId ?? null

    console.log(`[subscription/confirm] Profile ${profileId} (tgId=${tgId}) checking subscription. Inviter: ${inviterTgId}`)

    // ── 4. Check channel membership via Telegram Bot API ──
    if (!CHANNEL_ID) {
      return NextResponse.json({ success: false, error: 'CHANNEL_ID not configured' }, { status: 500 })
    }

    const status = await getChatMember(CHANNEL_ID, tgId)
    if (status === null) {
      return NextResponse.json({ success: false, error: 'Failed to check subscription' }, { status: 502 })
    }

    const isSubscribed = ['member', 'administrator', 'creator'].includes(status)
    if (!isSubscribed) {
      return NextResponse.json({ success: false, error: 'not_subscribed' }, { status: 403 })
    }

    // ── 5. Update DB Status ──
    await supabase
      .from('profiles')
      .update({ is_subscribed: true, subscribed_at: new Date().toISOString() })
      .eq('id', profileId)

    // ── 6. Process Referral ONLY on FIRST subscription ──
    if (!wasAlreadySubscribed && inviterTgId && inviterTgId !== tgId) {
      const { data: inviter } = await supabase
        .from('profiles')
        .select('id, tg_id, invites_count, dominant_trait, shadow_trait')
        .eq('tg_id', inviterTgId)
        .single()

      if (inviter) {
        const newInvites = (inviter.invites_count ?? 0) + 1
        await supabase
          .from('profiles')
          .update({ invites_count: newInvites })
          .eq('id', inviter.id)

        // Notification threshold
        if (newInvites === 2 && inviter.dominant_trait && inviter.shadow_trait) {
          const traits = [inviter.dominant_trait.toUpperCase(), inviter.shadow_trait.toUpperCase()].sort()
          const mixedText = MIXED_TRAIT_TEXTS[traits.join('')]
          
          if (mixedText) {
            await sendMessage({
              chatId: inviter.tg_id,
              text: `🎉 <b>Твой второй уровень открыт!</b>\n\nПришло время узнать твою теневую опору:\n\n${mixedText}`,
              parseMode: 'HTML',
            })
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: { isSubscribed: true } })
  } catch (err) {
    console.error('[subscription/confirm] Error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

