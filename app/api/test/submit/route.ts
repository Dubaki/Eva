import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { calculateScores, type Answer } from '@/lib/scoring'
import { QUESTIONS } from '@/lib/questions'
import { sendPhoto, sendMessage } from '@/lib/telegram-bot'
import { RESULT_TEXTS } from '@/lib/constants/texts'

export const dynamic = 'force-dynamic'

const TRAIT_IMAGES: Record<string, string> = {
  S: 'hero.png',
  U: 'pleaser.png',
  P: 'perfectionist.png',
  R: 'stayer.png',
  K: 'controller.png',
}

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return NextResponse.json({ success: false, error: 'Config error' }, { status: 500 })

  try {
    const body = await request.json()
    const answers: Answer[] = body.answers
    const bodyTgId = body.tgId

    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return NextResponse.json({ success: false, error: 'Invalid answers count' }, { status: 400 })
    }

    let profileId: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload?.sub) profileId = payload.sub
    }

    if (!profileId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: profile } = await supabaseAdmin.from('profiles').select('tg_id').eq('id', profileId).maybeSingle()
    if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })

    const tgId = profile.tg_id

    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    // RPC handles: test_results upsert, profiles update, referral, cooldown_reminder +60d, start_qualification +24h
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('submit_test_result_v2', {
      p_tg_id: tgId,
      p_profile_id: profileId,
      p_primary: primary,
      p_secondary: secondary,
      p_answers: answers,
      p_score_s: scores.scoreS,
      p_score_u: scores.scoreU,
      p_score_p: scores.scoreP,
      p_score_r: scores.scoreR,
      p_score_k: scores.scoreK
    })

    if (rpcError) {
      console.error('[API] RPC Error (submit_test_result_v2):', rpcError)
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 })
    }

    console.log(`[API] Test submitted for ${tgId}. Result:`, rpcData)

    // Send Message №3 to Telegram Bot
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const imageName = TRAIT_IMAGES[primary] || 'hero.png'
      const photoUrl = `${appUrl}/${imageName}`
      const caption = RESULT_TEXTS[primary] || `Ваша опора: ${primary}`

      const sent = await sendPhoto({
        chatId: Number(tgId),
        photo: photoUrl,
        caption: caption,
        parseMode: 'HTML'
      })

      if (!sent) {
        await sendMessage({
          chatId: Number(tgId),
          text: caption,
          parseMode: 'HTML'
        })
      }
    } catch (botErr) {
      console.error('[API] Failed to send Message №3 to bot (non-fatal):', botErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        dominantTrait: scores.dominantTrait,
        secondaryTrait: scores.secondaryTrait,
        referralProcessed: (rpcData as any)?.referral_processed
      }
    })
  } catch (err) {
    console.error('[API] Submit error:', err)
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}
