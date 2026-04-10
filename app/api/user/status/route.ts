import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer()

  // ── Mode 1: Direct tg_id via query param (used by home page subscription/cooldown check) ──
  const url = new URL(req.url)
  const tgIdParam = url.searchParams.get('tg_id')

  if (tgIdParam) {
    const tgId = parseInt(tgIdParam, 10)
    if (isNaN(tgId)) {
      return NextResponse.json({ success: false, error: 'Invalid tg_id' }, { status: 400 })
    }

    console.log(`!!! CRITICAL !!! /api/user/status called with tg_id=${tgId} (type: ${typeof tgIdParam})`)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, tg_id, is_subscribed, last_test_date, selected_sphere')
      .eq('tg_id', tgId)
      .maybeSingle()

    console.log(`!!! CRITICAL !!! Profile query result:`, {
      found: !!profile,
      tg_id_in_db: profile?.tg_id,
      is_subscribed: profile?.is_subscribed,
      type_of_is_subscribed: typeof profile?.is_subscribed,
      error: profileError ? JSON.stringify(profileError) : null,
    })

    // Fetch referral count
    const { count: refCount } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', profile?.id ?? '')

    // Fetch existing test results
    const { data: testResult } = await supabase
      .from('test_results')
      .select('dominant_trait, secondary_trait')
      .eq('profile_id', profile?.id ?? '')
      .single()

    // Check if qualification was completed
    const { data: qual } = await supabase
      .from('qualifications')
      .select('id')
      .eq('profile_id', profile?.id ?? '')
      .single()

    const responseData = {
      success: true,
      data: {
        isSubscribed: profile?.is_subscribed ?? false,
        lastTestDate: profile?.last_test_date ?? null,
        referralCount: refCount ?? 0,
        hasTestResult: !!testResult,
        dominantTrait: testResult?.dominant_trait ?? null,
        secondaryTrait: testResult?.secondary_trait ?? null,
        hasQualification: !!qual,
        selected_sphere: profile?.selected_sphere ?? null,
      },
    }

    console.log(`!!! CRITICAL !!! Response sent:`, JSON.stringify(responseData))
    return NextResponse.json(responseData)
  }

  // ── Mode 2: JWT-based auth (legacy / used by Gatekeeper) ──
  const jwtSecret = process.env.SUPABASE_JWT_SECRET

  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 401 })
  }

  const token = auth.slice(7)
  const payload = verifyJwt(token, jwtSecret)

  if (!payload) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  let profileId = payload.sub

  // Detect offline/synthetic token: sub format is "offline-{tg_id}-{timestamp}"
  let offlineTgId: number | null = null
  if (profileId?.startsWith?.('offline-')) {
    const tgIdStr = profileId.split('-')[1]
    const parsedTgId = parseInt(tgIdStr, 10)
    if (!isNaN(parsedTgId)) {
      offlineTgId = parsedTgId
    }
  }

  // Fetch profile — by ID for normal tokens, by tg_id for offline tokens
  let profile: {
    id: string
    tg_id: number
    is_subscribed: boolean | null
    last_test_date: string | null
    selected_sphere: string | null
  } | null = null

  if (offlineTgId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, tg_id, is_subscribed, last_test_date, selected_sphere')
      .eq('tg_id', offlineTgId)
      .maybeSingle()
    profile = data
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id, tg_id, is_subscribed, last_test_date, selected_sphere')
      .eq('id', profileId)
      .single()
    profile = data
  }

  // Fetch referral count
  const { count: refCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', profileId)

  // Fetch existing test results
  const { data: testResult } = await supabase
    .from('test_results')
    .select('dominant_trait, secondary_trait')
    .eq('profile_id', profileId)
    .single()

  // Check if qualification was completed
  const { data: qual } = await supabase
    .from('qualifications')
    .select('id')
    .eq('profile_id', profileId)
    .single()

  return NextResponse.json({
    success: true,
    data: {
      isSubscribed: profile?.is_subscribed ?? false,
      lastTestDate: profile?.last_test_date ?? null,
      referralCount: refCount ?? 0,
      hasTestResult: !!testResult,
      dominantTrait: testResult?.dominant_trait ?? null,
      secondaryTrait: testResult?.secondary_trait ?? null,
      hasQualification: !!qual,
      selected_sphere: profile?.selected_sphere ?? null,
    },
  })
}
