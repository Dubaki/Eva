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
    // ── 1. Request Validation (Read body early for tgId fallback) ──
    const body = await request.json()
    const answers: Answer[] = body.answers
    const bodyTgId = body.tgId
    
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return NextResponse.json({ 
        success: false, 
        error: `Ожидается ${QUESTIONS.length} ответов, получено ${answers?.length || 0}` 
      }, { status: 400 })
    }

    // ── 2. Authentication ──
    let profileId: string | null = null
    let tgId: number | null = null

    const authHeader = request.headers.get('authorization')
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

    if (profileId) {
      // Auth via JWT successful, now get tg_id for RPC
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tg_id')
        .eq('id', profileId)
        .single()
      
      if (profile) {
        tgId = profile.tg_id
      }
    } else if (bodyTgId) {
      // Fallback: Auth via tgId from body
      console.log('[test/submit] Using fallback tgId auth for tgId:', bodyTgId)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, tg_id')
        .eq('tg_id', bodyTgId)
        .single()
      
      if (profile) {
        profileId = profile.id
        tgId = profile.tg_id
      } else {
        // Auto-registration for new users
        console.log('[test/submit] Profile not found, creating new profile for tgId:', bodyTgId)
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .upsert({ tg_id: bodyTgId }, { onConflict: 'tg_id' })
          .select('id, tg_id')
          .single()
        
        if (createError || !newProfile) {
          console.error('[test/submit] Failed to auto-register profile:', createError)
        } else {
          profileId = newProfile.id
          tgId = newProfile.tg_id
          console.log('[test/submit] Auto-registered new profile:', profileId)
        }
      }
    }

    if (!profileId || !tgId) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization' }, { status: 401 })
    }

    // ── 3. Scoring Logic ──
    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    console.log(`[test/submit] Profile ${profileId} (tgId: ${tgId}) completed test. Traits: ${primary}/${secondary}`)

    // ── 4. Database Persistence (Admin bypass for RPC) ──
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