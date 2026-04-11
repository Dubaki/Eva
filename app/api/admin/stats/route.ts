import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

export async function GET(req: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    console.error('[admin/stats] Missing SUPABASE_JWT_SECRET')
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  // Check PIN first — if valid, bypass JWT requirement
  const adminPinHeader = req.headers.get('x-admin-pin')
  const isAdminViaPin = adminPinHeader === '2026'

  let profileId: string | null = null

  if (!isAdminViaPin) {
    // No PIN — require JWT
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      console.warn('[admin/stats] Missing token and no PIN')
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 401 })
    }

    const token = auth.slice(7)
    const payload = verifyJwt(token, jwtSecret)
    if (!payload) {
      console.warn('[admin/stats] Invalid or expired token')
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    profileId = payload.sub
  }

  const supabase = getSupabaseServer()

  // If we have a profileId, check TESTER_IDS; PIN alone is sufficient
  let isTester = false
  if (profileId) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tg_id')
      .eq('id', profileId)
      .single()

    if (profileError) {
      console.error('[admin/stats] Profile lookup error:', profileError)
    }

    if (profile) {
      isTester = TESTER_IDS.includes(String(profile.tg_id))
    }
  }

  if (!isAdminViaPin && !isTester) {
    console.warn('[admin/stats] Unauthorized access attempt')
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

  // Recent 50 users with their test results and referral data
  // Includes contact_author_clicked (migration 089 must be applied)
  const { data: recentUsers, error: usersError } = await supabase
    .from('profiles')
    .select('id, tg_id, username, created_at, invites_count, last_test_date, contact_author_clicked')
    .order('created_at', { ascending: false })
    .limit(50)

  if (usersError) {
    console.error('[admin/stats] Error fetching recent users:', usersError.message)
  }

  if (!recentUsers || recentUsers.length === 0) {
    console.error('[admin/stats] recentUsers is empty — no users in DB or query returned 0 results')
  }

  // Enrich with test results
  const recentUsersWithResults = await Promise.all(
    (recentUsers ?? []).map(async (user) => {
      const { data: testResult } = await supabase
        .from('test_results')
        .select('dominant_trait, secondary_trait')
        .eq('profile_id', user.id)
        .single()

      const lastTest = user.last_test_date ?? null
      const nextTestAvailable = lastTest
        ? new Date(new Date(lastTest).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
        : null

      return {
        tg_id: user.tg_id,
        username: user.username,
        created_at: user.created_at,
        dominantTrait: testResult?.dominant_trait ?? null,
        secondaryTrait: testResult?.secondary_trait ?? null,
        invites_count: user.invites_count ?? 0,
        last_test_date: lastTest,
        next_test_available: nextTestAvailable,
        contact_author_clicked: user.contact_author_clicked ?? false,
      }
    })
  )

  return NextResponse.json(
    {
      success: true,
      data: {
        totalUsers: totalUsers ?? 0,
        completedTests: completedTests ?? 0,
        traitCounts,
        recentUsers: recentUsersWithResults,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    }
  )
}
