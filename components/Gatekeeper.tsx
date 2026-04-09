'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

export default function Gatekeeper({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [reason, setReason] = useState<'not_subscribed' | 'cooldown' | null>(null)
  const [cooldownDays, setCooldownDays] = useState(0)

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem('eva_token')
      if (!token) {
        setChecking(false)
        return
      }

      try {
        const res = await fetch('/api/user/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()

        if (!json.success) {
          setChecking(false)
          return
        }

        const { isSubscribed, lastTestDate, hasTestResult } = json.data

        // Check if user is a tester (God mode)
        const profileRaw = localStorage.getItem('eva_profile')
        let tgId: number | null = null
        if (profileRaw) {
          try {
            tgId = (JSON.parse(profileRaw) as { tg_id?: number }).tg_id ?? null
          } catch { /* ignore */ }
        }

        const isTester = tgId !== null && TESTER_IDS.includes(String(tgId))

        // God mode: testers bypass all checks
        if (isTester) {
          setChecking(false)
          return
        }

        // Check subscription
        if (!isSubscribed) {
          setBlocked(true)
          setReason('not_subscribed')
          setChecking(false)
          return
        }

        // Check cooldown
        if (lastTestDate) {
          const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000
          const elapsed = Date.now() - new Date(lastTestDate).getTime()
          if (elapsed < COOLDOWN_MS) {
            const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
            setCooldownDays(daysLeft)
            // If they already have results and are in cooldown, redirect to result dashboard
            if (hasTestResult) {
              // Redirect to result page instead of blocking
              window.location.href = '/result'
              return
            }
          }
        }

        setChecking(false)
      } catch (err) {
        console.error('[Gatekeeper] Error:', err)
        setChecking(false)
      }
    }

    check()
  }, [])

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary">
        <motion.div
          className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </main>
    )
  }

  if (blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="text-[22px] font-bold text-text-primary mb-3">Доступ закрыт</h1>
          <p className="text-text-secondary text-[15px] leading-relaxed mb-6">
            Пожалуйста, откройте бота в Telegram, подпишитесь на канал и нажмите «Я подписалась».
          </p>
          <p className="text-text-muted text-[13px]">
            После подписки весь функционал станет доступен автоматически.
          </p>
        </motion.div>
      </main>
    )
  }

  return <>{children}</>
}
