import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
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

  const invitedId = payload.sub

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const refParam = (body as { startParam?: string }).startParam
  if (!refParam?.startsWith('ref')) {
    return NextResponse.json({ success: false, error: 'Invalid startParam' }, { status: 400 })
  }

  const raw = refParam.startsWith('ref_') ? refParam.slice(4) : refParam.slice(3)
  const refTgId = parseInt(raw, 10)
  if (isNaN(refTgId)) {
    return NextResponse.json({ success: false, error: 'Invalid referrer id' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  // Fetch invited user's tg_id to prevent self-referral
  const { data: invitedProfile } = await supabase
    .from('profiles')
    .select('id, tg_id, referrer_id')
    .eq('id', invitedId)
    .single()

  if (!invitedProfile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
  }

  // Already has a referrer
  if (invitedProfile.referrer_id) {
    return NextResponse.json({ success: true, data: { skipped: true } })
  }

  // Self-referral guard
  if (invitedProfile.tg_id === refTgId) {
    return NextResponse.json({ success: false, error: 'Self-referral not allowed' }, { status: 400 })
  }

  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('tg_id', refTgId)
    .single()

  if (!referrer) {
    return NextResponse.json({ success: false, error: 'Referrer not found' }, { status: 404 })
  }

  await supabase
    .from('profiles')
    .update({ referrer_id: referrer.id })
    .eq('id', invitedId)

  const { error } = await supabase
    .from('referrals')
    .insert({ owner_id: referrer.id, invited_id: invitedId, status: 'pending' })

  if (error && !error.message.includes('duplicate')) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { applied: true } })
}
