import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServer()

  // Total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Users who completed test (have results)
  const { count: completedTests } = await supabase
    .from('test_results')
    .select('*', { count: 'exact', head: true })

  // Stats by primary support
  const { data: traitStats } = await supabase
    .from('test_results')
    .select('primary_support')

  const traitCounts: Record<string, number> = { S: 0, U: 0, P: 0, R: 0, K: 0 }
  if (traitStats) {
    traitStats.forEach((row) => {
      const trait = row.primary_support.toUpperCase()
      if (traitCounts[trait] !== undefined) {
        traitCounts[trait]++
      }
    })
  }

  // Recent 50 users with their test results using JOIN
  const { data: recentUsers, error: usersError } = await supabase
    .from('profiles')
    .select(`
      id, tg_id, username, created_at, invites_count, last_test_date, contact_author_clicked,
      test_results!left (
        primary_support,
        secondary_support
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (usersError) {
    console.error('[admin/stats] Error fetching recent users:', usersError.message)
  }

  const recentUsersFormatted = (recentUsers ?? []).map((user: any) => {
    const testResult = user.test_results?.[0] || user.test_results // Depends on structure
    const lastTest = user.last_test_date ?? null
    const nextTestAvailable = lastTest
      ? new Date(new Date(lastTest).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
      : null

    return {
      tg_id: user.tg_id,
      username: user.username,
      created_at: user.created_at,
      primary_support: testResult?.primary_support ?? null,
      secondary_support: testResult?.secondary_support ?? null,
      invites_count: user.invites_count ?? 0,
      last_test_date: lastTest,
      next_test_available: nextTestAvailable,
      contact_author_clicked: user.contact_author_clicked ?? false,
    }
  })

  return NextResponse.json(
    {
      success: true,
      data: {
        totalUsers: totalUsers ?? 0,
        completedTests: completedTests ?? 0,
        traitCounts,
        recentUsers: recentUsersFormatted,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    }
  )
}
