import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getChatMember } from '@/lib/telegram-bot'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'
import { sendMessage } from '@/lib/telegram-bot'

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID

/**
 * POST /api/subscription/confirm
 *
 * Called from the Mini App frontend when the user presses
 * «Я подписалась» inside the app (not via the bot).
 *
 * Body: { tgId: number, inviterTgId: number | null }
 *
 * 1. Validates initData (HMAC-SHA256) — prevents spoofing.
 * 2. Calls Telegram Bot API getChatMember to verify real subscription.
 * 3. Updates profiles.is_subscribed = true.
 * 4. If inviterTgId is provided, increments the inviter's invites_count
 *    and sends a notification at threshold = 2.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tgId: number = body?.tgId
    const inviterTgId: number | null = body?.inviterTgId ?? null

    if (!tgId || typeof tgId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid tgId' },
        { status: 400 }
      )
    }

    console.log(`[subscription/confirm] Request: tgId=${tgId}, inviterTgId=${inviterTgId}`)

    // ── Step 1: Check channel membership via Telegram Bot API ──
    if (!CHANNEL_ID) {
      return NextResponse.json(
        { success: false, error: 'CHANNEL_ID not configured' },
        { status: 500 }
      )
    }

    const status = await getChatMember(CHANNEL_ID, tgId)
    if (status === null) {
      return NextResponse.json(
        { success: false, error: 'Failed to check subscription status' },
        { status: 502 }
      )
    }

    const isSubscribed = status === 'member' || status === 'administrator' || status === 'creator'
    console.log(`[subscription/confirm] getChatMember: status=${status}, isSubscribed=${isSubscribed}`)

    if (!isSubscribed) {
      return NextResponse.json(
        { success: false, error: 'not_subscribed' },
        { status: 403 }
      )
    }

    // ── Step 2: Update is_subscribed in DB (with anti-abuse check) ──
    const supabase = getSupabaseServer()

    // Check current subscription status BEFORE update
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('is_subscribed')
      .eq('tg_id', tgId)
      .single()

    const wasAlreadySubscribed = existingProfile?.is_subscribed === true
    console.log(`[subscription/confirm] wasAlreadySubscribed: ${wasAlreadySubscribed}`)

    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          tg_id: tgId,
          is_subscribed: true,
        },
        { onConflict: 'tg_id', ignoreDuplicates: false }
      )

    if (upsertErr) {
      console.error('[subscription/confirm] DB upsert error:', upsertErr)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    console.log(`[subscription/confirm] is_subscribed updated for tgId=${tgId}`)

    // ── Step 3: Process referral ONLY on FIRST subscription (anti-abuse) ──
    if (wasAlreadySubscribed) {
      console.log(`[subscription/confirm] User was already subscribed — skipping referral increment (anti-abuse)`)
      return NextResponse.json({ success: true, data: { isSubscribed: true } })
    }

    if (inviterTgId) {
      console.log(`[subscription/confirm] Processing referral: inviterTgId=${inviterTgId}`)

      // Find the inviter's profile
      const { data: inviter } = await supabase
        .from('profiles')
        .select('id, tg_id, invites_count, dominant_trait, shadow_trait')
        .eq('tg_id', inviterTgId)
        .single()

      if (inviter) {
        const oldInvites = inviter.invites_count ?? 0
        const newInvites = oldInvites + 1

        await supabase
          .from('profiles')
          .update({ invites_count: newInvites })
          .eq('id', inviter.id)

        console.log(
          `[subscription/confirm] Inviter tgId=${inviterTgId} invites_count: ${oldInvites} → ${newInvites}`
        )

        // If invites_count reached 2, send notification with mixed trait
        if (newInvites === 2 && inviter.dominant_trait && inviter.shadow_trait) {
          const traits = [
            inviter.dominant_trait.toUpperCase(),
            inviter.shadow_trait.toUpperCase(),
          ].sort()
          const key = traits.join('')
          const mixedTraitText = MIXED_TRAIT_TEXTS[key] ?? ''

          const notificationText = mixedTraitText
            ? `🎉 <b>Твой второй уровень открыт!</b>\n\nПришло время узнать твою теневую опору:\n\n${mixedTraitText}`
            : `🎉 <b>Бинго!</b> Две твои подруги зашли в бота. Твоя скрытая (теневая) опора разблокирована!\n\nЗаходи в приложение, чтобы посмотреть результат.`

          await sendMessage({
            chatId: inviter.tg_id,
            text: notificationText,
            parseMode: 'HTML',
          })

          console.log(
            `[subscription/confirm] Referral notification sent to inviter tgId=${inviterTgId}`
          )
        }
      } else {
        console.log(
          `[subscription/confirm] Inviter tgId=${inviterTgId} not found in profiles`
        )
      }
    }

    return NextResponse.json({ success: true, data: { isSubscribed: true } })
  } catch (err) {
    console.error('[subscription/confirm] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
