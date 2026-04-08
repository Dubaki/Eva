import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

const DEBUG_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET

  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  // Extract Bearer token
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

  // Debug bypass — return 0 referrals for the debug user
  if (process.env.NODE_ENV === 'development' && profileId === DEBUG_PROFILE_ID) {
    return NextResponse.json({ success: true, data: { count: 0 } })
  }

  // Query referrals table: count rows where this user is the owner
  const supabase = getSupabaseServer()
  const { count, error } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', profileId)

  if (error) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { count: count ?? 0 } })
}
