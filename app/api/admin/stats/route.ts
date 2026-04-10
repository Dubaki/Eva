import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

export async function GET(req: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    console.error('[admin/stats] Missing SUPABASE_JWT_SECRET')
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    console.warn('[admin/stats] Missing token')
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 401 })
  }

  const token = auth.slice(7)
  const payload = verifyJwt(token, jwtSecret)
  if (!payload) {
    console.warn('[admin/stats] Invalid or expired token')
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  const supabase = getSupabaseServer()

  // Check if this user is a tester (admin access)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tg_id')
    .eq('id', payload.sub)
    .single()

  // Also check for admin access via PIN (passed as X-Admin-Access header from client)
  const adminAccessHeader = req.headers.get('x-admin-access')
  const isAdminViaPin = adminAccessHeader === 'true'

  if (profileError) {
    console.error('[admin/stats] Profile lookup error:', profileError)
  }

  if (!profile || (!TESTER_IDS.includes(String(profile.tg_id)) && !isAdminViaPin)) {
    console.warn('[admin/stats] Unauthorized access attempt by sub:', payload.sub, 'profile:', profile)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  // Total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Users who completed test (have results)
  const { count: completedTests } = await supabase
    .from('test_results')
    .select('*', { count: 'exact', head: true })

  // Stats by dominant trait
  const { data: traitStats } = await supabase
    .from('test_results')
    .select('dominant_trait')

  const traitCounts: Record<string, number> = { S: 0, U: 0, P: 0, R: 0, K: 0 }
  if (traitStats) {
    traitStats.forEach((row) => {
      const trait = row.dominant_trait.toUpperCase()
      if (traitCounts[trait] !== undefined) {
        traitCounts[trait]++
      }
    })
  }

  // Recent 20 users with their test results
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, tg_id, username, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  // Enrich with test results
  const recentUsersWithResults = await Promise.all(
    (recentUsers ?? []).map(async (user) => {
      const { data: testResult } = await supabase
        .from('test_results')
        .select('dominant_trait, secondary_trait')
        .eq('profile_id', user.id)
        .single()

      return {
        tg_id: user.tg_id,
        username: user.username,
        created_at: user.created_at,
        dominantTrait: testResult?.dominant_trait ?? null,
        secondaryTrait: testResult?.secondary_trait ?? null,
      }
    })
  )

  return NextResponse.json({
    success: true,
    data: {
      totalUsers: totalUsers ?? 0,
      completedTests: completedTests ?? 0,
      traitCounts,
      recentUsers: recentUsersWithResults,
    },
  })
}
