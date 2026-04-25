import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import { getSupabaseServer } from '@/lib/supabase/server'
import { triggerBotNotification } from '@/lib/bot-notification'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

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

  // Fetch invited user's tg_id and check if already confirmed
  const { data: invitedProfile } = await supabase
    .from('profiles')
    .select('id, tg_id, referred_by, referral_confirmed')
    .eq('id', invitedId)
    .maybeSingle()

  if (!invitedProfile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
  }

  // Already has a confirmed referrer or already linked to someone else
  if (invitedProfile.referral_confirmed || invitedProfile.referred_by) {
    return NextResponse.json({ success: true, data: { skipped: true } })
  }

  // Self-referral guard
  if (invitedProfile.tg_id === refTgId) {
    return NextResponse.json({ success: false, error: 'Self-referral not allowed' }, { status: 400 })
  }

  // Update referred_by (trigger will sync referrer_id)
  await supabase
    .from('profiles')
    .update({ referred_by: refTgId })
    .eq('id', invitedId)

  return NextResponse.json({ success: true, data: { applied: true } })
}
