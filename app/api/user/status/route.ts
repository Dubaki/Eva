import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
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

  const profileId = payload.sub

  const supabase = getSupabaseServer()

  // Fetch profile info
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tg_id, is_subscribed, last_test_date')
    .eq('id', profileId)
    .single()

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
    },
  })
}
