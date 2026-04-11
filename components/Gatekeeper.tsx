'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000 // 60 days

export type GatekeeperState =
  | { checking: true }
  | { checking: false; blocked: true; reason: 'not_subscribed' | 'cooldown' | 'no_webapp'; cooldownDays?: number }
  | { checking: false; blocked: false; cooldownDays?: number }

export default function Gatekeeper({ children, onStatus }: { children: React.ReactNode; onStatus?: (status: GatekeeperState) => void }) {
  const [checking, setChecking] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [reason, setReason] = useState<'not_subscribed' | 'cooldown' | 'no_webapp' | null>(null)
  const [cooldownDays, setCooldownDays] = useState(0)

  useEffect(() => {
    const check = async () => {
      // Get tgId directly from Telegram WebApp — no JWT needed
      const WebApp = typeof window !== 'undefined'
        ? (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp
        : null
      const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? null

      if (!currentTgId) {
        console.warn('[Gatekeeper] No WebApp tgId — user not in Telegram')
        setChecking(false) // Not in Telegram — let the page render normally
        return
      }

      // Check if user is a tester (God mode)
      const isTester = TESTER_IDS.includes(String(currentTgId))
      if (isTester) {
        console.log('[Gatekeeper] Tester bypass:', currentTgId)
        setChecking(false)
        return
      }

      try {
        // Fetch profile status via tg_id — no JWT, service_role on server side
        const res = await fetch(`/api/user/status?tg_id=${currentTgId}`)
        const json = await res.json()

        console.log('[Gatekeeper] /api/user/status response:', JSON.stringify(json))

        if (!json.success) {
          console.error('[Gatekeeper] Status check failed:', json.error)
          setChecking(false)
          return
        }

        const { isSubscribed, lastTestDate, hasTestResult } = json.data

        // Gate 1: Subscription check
        if (!isSubscribed) {
          console.warn('[Gatekeeper] User not subscribed: isSubscribed=false')
          setBlocked(true)
          setReason('not_subscribed')
          setChecking(false)
          return
        }

        // Gate 2: Cooldown check — DO NOT REDIRECT, just inform
        if (lastTestDate) {
          const elapsed = Date.now() - new Date(lastTestDate).getTime()
          if (elapsed < COOLDOWN_MS) {
            const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
            setCooldownDays(daysLeft)
            // If user has a test result, they're on cooldown — but we DON'T redirect
            // They can still access results and referrals, just not start a new test
            console.log(`[Gatekeeper] User on cooldown: ${daysLeft} days remaining`)
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
    const reasonMessages: Record<string, { title: string; message: string; hint: string }> = {
      not_subscribed: {
        title: 'Доступ закрыт',
        message: 'Пожалуйста, откройте бота в Telegram, подпишитесь на канал и нажмите «Я подписалась».',
        hint: 'После подписки весь функционал станет доступен автоматически.',
      },
      cooldown: {
        title: 'Тест ещё не доступен',
        message: `Следующий тест будет доступен через ${cooldownDays} ${cooldownDays === 1 ? 'день' : cooldownDays < 5 ? 'дня' : 'дней'}.`,
        hint: 'Это нужно, чтобы ваши результаты были точными и значимыми.',
      },
      no_webapp: {
        title: 'Откройте через Telegram',
        message: 'Это приложение работает только внутри Telegram. Откройте бота и нажмите «Пройти тест».',
        hint: 'Найдите бота в Telegram и запустите его.',
      },
    }

    const msg = reason ? reasonMessages[reason] : reasonMessages.not_subscribed

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="text-[22px] font-bold text-text-primary mb-3">{msg.title}</h1>
          <p className="text-text-secondary text-[15px] leading-relaxed mb-6">
            {msg.message}
          </p>
          <p className="text-text-muted text-[13px]">
            {msg.hint}
          </p>
        </motion.div>
      </main>
    )
  }

  return <>{children}</>
}
