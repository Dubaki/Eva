import { NextRequest, NextResponse } from 'next/server'
import { signJwt } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()
    const isDev = process.env.NODE_ENV === 'development'
    // PIN управляется через env-переменную ADMIN_PIN
    const adminPin = process.env.ADMIN_PIN || (isDev ? '0999' : undefined)
    const jwtSecret = process.env.SUPABASE_JWT_SECRET

    if (!jwtSecret || (!adminPin && !isDev)) {
      console.error('[admin/login] Missing ADMIN_PIN in production or missing JWT secret')
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    if (pin && pin === adminPin) {
      // Генерируем короткоживущий токен для админа (на 1 час)
      const jwtSecret = process.env.EVA_JWT_SECRET || process.env.SUPABASE_JWT_SECRET
      if (!jwtSecret) return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })

      const token = signJwt({
        sub: 'admin-session',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      }, jwtSecret)

      return NextResponse.json({ success: true, token })
    }

    return NextResponse.json({ success: false, error: 'Неверный PIN-код' }, { status: 401 })
  } catch (err) {
    console.error('[admin/login] Error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
