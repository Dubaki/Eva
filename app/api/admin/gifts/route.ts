import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/gifts — получить ссылки на подарки из app_settings
 * POST /api/admin/gifts — сохранить ссылки на подарки в app_settings
 */

const GIFT_KEYS = ['gift_money', 'gift_relations', 'gift_health', 'gift_other'] as const

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', GIFT_KEYS)

  if (error) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
  }

  const links: Record<string, string> = {}
  for (const key of GIFT_KEYS) {
    links[key] = data?.find((r) => r.key === key)?.value ?? ''
  }

  return NextResponse.json(
    { success: true, data: links },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    }
  )
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  for (const key of GIFT_KEYS) {
    const value = body[key] ?? ''
    await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  return NextResponse.json({ success: true })
}
