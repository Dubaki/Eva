import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { triggerBotNotification } from '@/lib/bot-notification'
import { MIXED_TRAIT_TEXTS } from '@/lib/telegram'


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

function parseAndValidate(
  initData: string,
  botToken: string,
): { user: TelegramUser; authDate: number } | null {
  const params = new URLSearchParams(initData)

  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()

  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  let valid = false
  try {
    valid = timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    )
  } catch {
    return null 
  }
  if (!valid) return null

  const authDate = parseInt(params.get('auth_date') ?? '0', 10)
  const age = Math.floor(Date.now() / 1000) - authDate
  // Allow up to 24 hours — 5-min window breaks WebApp flows where user spends
  // time subscribing before the JWT is issued. HMAC signature alone is sufficient.
  if (age > 86400 || age < 0) return null

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
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
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

  if (typeof body !== 'object' || body === null || typeof (body as any).initData !== 'string') {
    return fail('Missing initData', 400)
  }

  const initData = (body as any).initData
  const startParam = (body as any).startParam

  // 1. Validate Telegram signature
  const parsed = parseAndValidate(initData, botToken)
  if (!parsed) {
    console.error('[auth] Invalid or expired initData')
    return fail('Invalid or expired initData', 401)
  }

  const { user } = parsed
  const supabase = getSupabaseServer()

  // 2. Ищем или создаём профиль
  let profile: any = null

  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, tg_id, username, avatar_url, is_subscribed, referrer_id, referred_by, invites_count, dominant_trait, shadow_trait, created_at')
    .eq('tg_id', user.id)
    .limit(1)

  if (existingProfiles && existingProfiles.length > 0) {
    profile = existingProfiles[0]
  } else {
    const { data: newProfiles, error: insertErr } = await supabase
      .from('profiles')
      .insert([{
        tg_id: user.id,
        username: user.username ?? null,
        avatar_url: user.photo_url ?? null,
        is_subscribed: false,
      }])
      .select('id, tg_id, username, avatar_url, is_subscribed, referrer_id, referred_by, invites_count, dominant_trait, shadow_trait, created_at')

    if (insertErr) {
      console.error('[auth] DB insert error:', insertErr)
      return fail('Database unavailable. Please try again later.', 503)
    }
    if (newProfiles && newProfiles.length > 0) profile = newProfiles[0]
  }

  if (!profile) return fail('Could not create profile', 500)

  // Реферал засчитывается при подписке на канал (в webhook check_sub), не здесь

  // 4. Issue JWT
  const now = Math.floor(Date.now() / 1000)
  const token = signJwt(
    {
      sub: profile.id,
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