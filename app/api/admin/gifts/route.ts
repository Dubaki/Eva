import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

/**
 * GET /api/admin/gifts — получить ссылки на подарки из app_settings
 * POST /api/admin/gifts — сохранить ссылки на подарки в app_settings
 */

async function checkAdmin(req: NextRequest): Promise<{ authorized: boolean; profileId?: string }> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return { authorized: false }

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return { authorized: false }

  const token = auth.slice(7)
  const payload = verifyJwt(token, jwtSecret)
  if (!payload) return { authorized: false }

  // Check TESTER_IDS or PIN access
  const adminPinHeader = req.headers.get('x-admin-pin')
  const isAdminViaPin = adminPinHeader === '2026'

  const supabase = getSupabaseServer()
  const { data: profile } = await supabase
    .from('profiles')
    .select('tg_id')
    .eq('id', payload.sub)
    .single()

  if (profile && (TESTER_IDS.includes(String(profile.tg_id)) || isAdminViaPin)) {
    return { authorized: true, profileId: payload.sub }
  }

  return { authorized: false }
}

const GIFT_KEYS = ['gift_money', 'gift_relations', 'gift_health', 'gift_other'] as const

export async function GET(req: NextRequest) {
  const { authorized } = await checkAdmin(req)
  if (!authorized) {
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

  return NextResponse.json({ success: true, data: links })
}

export async function POST(req: NextRequest) {
  const { authorized } = await checkAdmin(req)
  if (!authorized) {
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
