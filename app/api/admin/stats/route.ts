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

  // 1. Общее кол-во пользователей
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // 2. Пройдено тестов (у кого есть запись в test_results)
  const { count: completedTests } = await supabase
    .from('test_results')
    .select('*', { count: 'exact', head: true })

  // 3. Обратились к Еве
  const { count: contactAuthorCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('contact_author_clicked', true)

  // 4. Список пользователей
  const { data: recentUsers, error: usersError } = await supabase
    .from('profiles')
    .select('tg_id, username, created_at, invites_count, last_test_date, contact_author_clicked')
    .order('created_at', { ascending: false })
    .limit(200)

  if (usersError) {
    console.error('[admin/stats] Error fetching users:', usersError.message)
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        totalUsers: totalUsers ?? 0,
        completedTests: completedTests ?? 0,
        contactAuthorCount: contactAuthorCount ?? 0,
        recentUsers: recentUsers ?? [],
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    }
  )
}
