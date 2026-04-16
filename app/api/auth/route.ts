import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

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

  // 2. БРОНЯ: Ищем или создаем профиль без глючного upsert
  let profile: any = null

  // Пытаемся найти существующий
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, tg_id, username, avatar_url, is_subscribed, referrer_id, created_at')
    .eq('tg_id', user.id)
    .limit(1)

  if (existingProfiles && existingProfiles.length > 0) {
    profile = existingProfiles[0]
  } else {
    // ЖЕСТКАЯ РЕГИСТРАЦИЯ: Создаем новый профиль (как это делает бот)
    const { data: newProfiles, error: insertErr } = await supabase
      .from('profiles')
      .insert([{
        tg_id: user.id,
        username: user.username ?? null,
        avatar_url: user.photo_url ?? null,
        is_subscribed: false // Статус подписки обновится позже через Gatekeeper
      }])
      .select('id, tg_id, username, avatar_url, is_subscribed, referrer_id, created_at')

    if (insertErr) {
      console.error('[auth] DB insert error:', insertErr)
      return fail('Database unavailable. Please try again later.', 503)
    }
    
    if (newProfiles && newProfiles.length > 0) {
      profile = newProfiles[0]
    }
  }

  if (!profile) {
    return fail('Could not create profile', 500)
  }

  // 3. Process referral
  if (startParam?.startsWith('ref') && !profile.referrer_id) {
    const raw = startParam.startsWith('ref_') ? startParam.slice(4) : startParam.slice(3)
    const refTgId = parseInt(raw, 10)
    if (!isNaN(refTgId) && refTgId !== profile.tg_id) {
      try {
        const { data: referrer } = await supabase.from('profiles').select('id').eq('tg_id', refTgId).limit(1)
        if (referrer && referrer.length > 0) {
          await supabase.from('profiles').update({ referrer_id: referrer[0].id }).eq('id', profile.id)
          await supabase.from('referrals').insert({ owner_id: referrer[0].id, invited_id: profile.id, status: 'pending' })
        }
      } catch (refErr) {
        console.error('[auth] Referral processing error:', refErr)
      }
    }
  }

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