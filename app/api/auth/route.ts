import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

// ── Response helpers ────────────────────────────────────────────────────────

type Ok<T> = { success: true; data: T }
type Err = { success: false; error: string }

function ok<T>(data: T, status = 200) {
  return NextResponse.json<Ok<T>>({ success: true, data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json<Err>({ success: false, error: message }, { status })
}

// ── Telegram types ──────────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
}

// ── HMAC-SHA256 initData validation ────────────────────────────────────────
// Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

function parseAndValidate(
  initData: string,
  botToken: string,
): { user: TelegramUser; authDate: number } | null {
  const params = new URLSearchParams(initData)

  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  // Build data_check_string: sorted key=value pairs joined by \n
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()

  // expected_hash = HMAC_SHA256(data_check_string, secret_key)
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  // Constant-time comparison — prevents timing attacks
  let valid = false
  try {
    valid = timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    )
  } catch {
    return null // malformed hash (wrong length)
  }
  if (!valid) return null

  // Replay-attack guard: initData must be ≤ 300 seconds old
  const authDate = parseInt(params.get('auth_date') ?? '0', 10)
  const age = Math.floor(Date.now() / 1000) - authDate
  if (age > 300 || age < 0) return null

  const userRaw = params.get('user')
  if (!userRaw) return null

  let user: TelegramUser
  try {
    user = JSON.parse(userRaw) as TelegramUser
  } catch {
    return null
  }

  if (!user.id) return null

  return { user, authDate }
}

// ── JWT (Supabase Custom Token) ─────────────────────────────────────────────

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${sig}`
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const jwtSecret = process.env.SUPABASE_JWT_SECRET

  if (!botToken || !jwtSecret) {
    console.error('[auth] Missing env: TELEGRAM_BOT_TOKEN or SUPABASE_JWT_SECRET')
    return fail('Server misconfiguration', 500)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail('Invalid JSON body', 400)
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).initData !== 'string'
  ) {
    return fail('Missing initData', 400)
  }

  const initData = (body as { initData: string; startParam?: string }).initData
  const startParam = (body as { initData: string; startParam?: string }).startParam

  // ── Debug bypass (development only, never runs in production) ───────────
  if (process.env.NODE_ENV === 'development' && initData === 'debug') {
    const devSecret = process.env.SUPABASE_JWT_SECRET ?? 'dev-only-insecure-secret'
    const now = Math.floor(Date.now() / 1000)
    const token = signJwt(
      {
        sub: '00000000-0000-0000-0000-000000000001',
        role: 'authenticated',
        aud: 'authenticated',
        iss: 'supabase',
        iat: now,
        exp: now + 60 * 60 * 24 * 7,
      },
      devSecret,
    )
    return ok({
      profile: {
        id: '00000000-0000-0000-0000-000000000001',
        tg_id: 99999999,
        username: 'debug_user',
        avatar_url: null,
        is_subscribed: false,
        created_at: new Date().toISOString(),
      },
      token,
    })
  }

  // 1. Validate Telegram signature
  const parsed = parseAndValidate(initData, botToken)
  if (!parsed) {
    return fail('Invalid or expired initData', 401)
  }

  const { user } = parsed

  // 2. Upsert profile (service_role bypasses RLS — correct here, user has no JWT yet)
  const upsertData: ProfileInsert = {
    tg_id: user.id,
    username: user.username ?? null,
    avatar_url: user.photo_url ?? null,
    updated_at: new Date().toISOString(),
  }

  const supabase = getSupabaseServer()
  const { data: profile, error: dbError } = await supabase
    .from('profiles')
    .upsert(upsertData, { onConflict: 'tg_id', ignoreDuplicates: false })
    .select('id, tg_id, username, avatar_url, is_subscribed, referrer_id, created_at')
    .single()

  if (dbError || !profile) {
    console.error('[auth] DB upsert error:', dbError)
    return fail('Database error', 500)
  }

  // 3. Process referral if this is a new user (no referrer_id yet)
  // Supports both formats: "ref_123" (startapp) and "ref123" (legacy /start)
  if (startParam?.startsWith('ref') && !profile.referrer_id) {
    const raw = startParam.startsWith('ref_') ? startParam.slice(4) : startParam.slice(3)
    const refTgId = parseInt(raw, 10)
    if (!isNaN(refTgId) && refTgId !== user.id) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('tg_id', refTgId)
        .single()

      if (referrer) {
        // Mark referrer on the new user's profile
        await supabase
          .from('profiles')
          .update({ referrer_id: referrer.id })
          .eq('id', profile.id)

        // Insert referral record (ignore duplicate errors)
        await supabase
          .from('referrals')
          .insert({ owner_id: referrer.id, invited_id: profile.id, status: 'pending' })
      }
    }
  }

  // 5. Issue 7-day Supabase-compatible JWT
  const now = Math.floor(Date.now() / 1000)
  const token = signJwt(
    {
      sub: profile.id,       // maps to auth.uid() in RLS policies
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: now,
      exp: now + 60 * 60 * 24 * 7,
    },
    jwtSecret,
  )

  return ok({ profile, token })
}
