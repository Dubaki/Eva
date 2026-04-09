'use client'

import { useEffect } from 'react'

const JWT_KEY = 'eva_token'
const REAUTH_BUFFER_S = 60 // re-auth if token expires within 60s

function isTokenValid(token: string): boolean {
  try {
    // base64url → base64 conversion before atob
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    const now = Math.floor(Date.now() / 1000)
    return typeof payload.exp === 'number' && payload.exp > now + REAUTH_BUFFER_S
  } catch {
    return false
  }
}

async function doAuth(initData: string, startParam?: string): Promise<void> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, startParam }),
  })

  if (!res.ok) return

  const json = (await res.json()) as {
    success: boolean
    data?: { token: string; profile?: unknown }
  }
  if (json.success && json.data?.token) {
    localStorage.setItem(JWT_KEY, json.data.token)
    if (json.data.profile) {
      localStorage.setItem('eva_profile', JSON.stringify(json.data.profile))
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Skip if we already have a valid token
    const stored = localStorage.getItem(JWT_KEY)
    if (stored && isTokenValid(stored)) return

    // ── Debug bypass (development only) ──────────────────────────────────
    // Activate by opening the app with ?debug=true in the URL.
    // The server will return a mock profile + JWT without Telegram validation.
    const isDebug =
      process.env.NODE_ENV === 'development' &&
      window.location.search.includes('debug=true')

    if (isDebug) {
      doAuth('debug').catch(() => {})
      return
    }

    // ── Normal flow: Telegram TMA ─────────────────────────────────────────
    const tgWebApp = (window as unknown as {
      Telegram?: {
        WebApp?: {
          initData?: string
          initDataUnsafe?: { start_param?: string }
        }
      }
    }).Telegram?.WebApp

    const initData: string = tgWebApp?.initData ?? ''

    if (!initData) return // not running inside Telegram — skip silently

    const startParam = tgWebApp?.initDataUnsafe?.start_param
    doAuth(initData, startParam).catch(() => {})
  }, [])

  return <>{children}</>
}
