import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { calculateScores, type Answer } from '@/lib/scoring'
import { triggerBotNotification } from '@/lib/bot-notification'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { QUESTIONS } from '@/lib/questions'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    // ── 1. JWT Authentication ──
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing authorization token' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = verifyJwt(token, jwtSecret)
    if (!payload || !payload.sub) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const profileId = payload.sub

    // ── 2. Request Validation ──
    const body = await request.json()
    const answers: Answer[] = body.answers
    
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return NextResponse.json({ 
        success: false, 
        error: `Ожидается ${QUESTIONS.length} ответов, получено ${answers?.length || 0}` 
      }, { status: 400 })
    }

    // ── 3. Scoring Logic ──
    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    console.log(`[test/submit] Profile ${profileId} completed test. Traits: ${primary}/${secondary}`)

    // ── 4. Database Persistence (Admin bypass for RPC) ──
    const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey)

    // First, we need to get the numeric tg_id for the RPC (which uses tg_id)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tg_id')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) {
      console.error('[test/submit] Profile not found for UUID:', profileId)
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const tgId = profile.tg_id

    console.log('[test/submit] Calling RPC save_test_result for tg_id:', tgId)

    const { error: dbError } = await supabaseAdmin.rpc('save_test_result', {
      p_tg_id: tgId,
      p_primary_support: primary,
      p_secondary_support: secondary,
    })

    if (dbError) {
      console.error('[test/submit] RPC Error:', dbError)
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })
    }

    // Reset current_step after successful test completion
    await supabaseAdmin
      .from('profiles')
      .update({ current_step: null })
      .eq('id', profileId)

    // ── 5. Post-submit actions (Notifications) ──
    triggerBotNotification({
      event: 'dominant_trait_set',
      profile_id: profileId,
      tg_id: tgId,
      trait: primary,
    }).catch(err => console.error('[test/submit] Notification failed:', err))

    return NextResponse.json({
      success: true,
      data: {
        dominantTrait: scores.dominantTrait,
        secondaryTrait: scores.secondaryTrait,
        scores
      },
    })
  } catch (err) {
    console.error('[test/submit] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}