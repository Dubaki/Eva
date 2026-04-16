import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getChatMember } from '@/lib/telegram-bot'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'
import { sendMessage } from '@/lib/telegram-bot'
import { verifyJwt } from '@/lib/jwt'
import { createClient } from '@supabase/supabase-js'

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
    // ── 1. Parse Request Body ──
    let body: any = {}
    try {
      body = await req.json()
    } catch (e) { /* ignore */ }

    const bodyTgId: number | null = body?.tgId ?? null
    const inviterTgId: number | null = body?.inviterTgId ?? null

    // ── 2. Authentication (JWT or tgId fallback) ──
    let profileId: string | null = null
    let tgId: number | null = null

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload && payload.sub) {
        profileId = payload.sub
      }
    }

    const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey)

    let profileData: any = null

    if (profileId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, tg_id, is_subscribed')
        .eq('id', profileId)
        .single()
      profileData = data
    } else if (bodyTgId) {
      console.log('[subscription/confirm] Using fallback tgId auth for tgId:', bodyTgId)
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, tg_id, is_subscribed')
        .eq('tg_id', bodyTgId)
        .single()
      profileData = data
    }

    if (!profileData) {
      return NextResponse.json({ success: false, error: 'Profile not found or missing auth' }, { status: 401 })
    }

    profileId = profileData.id
    tgId = profileData.tg_id
    const wasAlreadySubscribed = profileData.is_subscribed === true

    if (!tgId) {
      return NextResponse.json({ success: false, error: 'Telegram ID missing' }, { status: 400 })
    }

    console.log(`[subscription/confirm] Profile ${profileId} (tgId=${tgId}) checking subscription. Inviter: ${inviterTgId}`)

    // ── 3. Check channel membership via Telegram Bot API ──
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

    // ── 4. Update DB Status ──
    await supabaseAdmin
      .from('profiles')
      .update({ is_subscribed: true, subscribed_at: new Date().toISOString() })
      .eq('id', profileId)

    // ── 5. Process Referral ONLY on FIRST subscription ──
    if (!wasAlreadySubscribed && inviterTgId && inviterTgId !== tgId) {
      const { data: inviter } = await supabaseAdmin
        .from('profiles')
        .select('id, tg_id, invites_count, dominant_trait, shadow_trait')
        .eq('tg_id', inviterTgId)
        .single()

      if (inviter) {
        const newInvites = (inviter.invites_count ?? 0) + 1
        await supabaseAdmin
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

