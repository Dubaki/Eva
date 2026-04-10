import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

// ── Kill ALL caching: no server cache, no CDN cache, no browser cache ──
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer()

  // ── Mode 1: Direct tg_id via query param (used by home page subscription/cooldown check) ──
  const url = new URL(req.url)
  const tgIdParam = url.searchParams.get('tg_id')

  if (tgIdParam) {
    const numericTgId = Number(tgIdParam)
    if (isNaN(numericTgId)) {
      return NextResponse.json({ success: false, error: 'Invalid tg_id' }, { status: 400 })
    }

    console.log(`!!! CRITICAL !!! /api/user/status called with tg_id=${numericTgId} (type: ${typeof numericTgId}, raw: "${tgIdParam}")`)

    // FULL raw query dump to diagnose RLS/type/silent error
    const { data: rawData, error: rawError } = await supabase
      .from('profiles')
      .select('*')
      .eq('tg_id', numericTgId)

    console.log(`!!! CRITICAL !!! RAW DB RESPONSE:`, {
      raw_data: JSON.stringify(rawData),
      db_error: rawError ? JSON.stringify(rawError) : 'null',
      array_length: rawData?.length ?? 0,
      first_row_is_subscribed: rawData?.[0]?.is_subscribed,
    })

    const profile = rawData?.[0] ?? null

    const responseData = {
      success: true,
      data: {
        isSubscribed: profile?.is_subscribed ?? false,
        lastTestDate: profile?.last_test_date ?? null,
        referralCount: 0,
        hasTestResult: false,
        dominantTrait: null,
        secondaryTrait: null,
        hasQualification: false,
        selected_sphere: profile?.selected_sphere ?? null,
      },
      // EXPOSE raw data to frontend for debugging
      raw_data: rawData,
      db_error: rawError,
    }

    console.log(`!!! CRITICAL !!! Response sent:`, JSON.stringify(responseData))
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
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

  return NextResponse.json(
    {
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
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}
