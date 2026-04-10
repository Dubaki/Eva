'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const ADMIN_PIN = '2026'
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000 // 60 days

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut', delay },
})

export default function Home() {
  const clickTimesRef = useRef<number[]>([])
  const [checking, setChecking] = useState(true)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [cooldownDays, setCooldownDays] = useState<number | null>(null)
  const [debugTgId, setDebugTgId] = useState<number | null>(null)
  const [debugRawData, setDebugRawData] = useState<unknown>(null)
  const [debugDbError, setDebugDbError] = useState<unknown>(null)

  useEffect(() => {
    // Get tgId directly from Telegram WebApp
    const WebApp = typeof window !== 'undefined'
      ? (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp
      : null
    const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? null
    setDebugTgId(currentTgId)

    if (!currentTgId) {
      setChecking(false)
      return // not in Telegram — skip checks, show normal page
    }

    fetch(`/api/user/status?tg_id=${currentTgId}`)
      .then((r) => r.json())
      .then((json) => {
        console.log('!!! CRITICAL !!! [/page.tsx] API response:', JSON.stringify(json))
        console.log('!!! CRITICAL !!! [/page.tsx] tgId sent:', currentTgId, 'isSubscribed:', json.data?.isSubscribed)

        setDebugRawData(json.raw_data ?? null)
        setDebugDbError(json.db_error ?? null)

        if (!json.success) {
          setChecking(false)
          return
        }

        // Gate 1: Subscription check
        if (!json.data?.isSubscribed) {
          console.log('!!! CRITICAL !!! [/page.tsx] BLOCKED: isSubscribed=false')
          setNotSubscribed(true)
          setChecking(false)
          return
        }

        console.log('!!! CRITICAL !!! [/page.tsx] PASSED: isSubscribed=true')

        // Gate 2: Cooldown check
        if (json.data?.lastTestDate) {
          const lastTest = new Date(json.data.lastTestDate).getTime()
          const elapsed = Date.now() - lastTest
          const remaining = COOLDOWN_MS - elapsed
          if (remaining > 0) {
            setCooldownDays(Math.ceil(remaining / (24 * 60 * 60 * 1000)))
          }
        }

        setChecking(false)
      })
      .catch(() => { setChecking(false) })
  }, [])

  const handleTitleClick = useCallback(() => {
    const now = Date.now()
    // Clean old clicks (> 2 seconds)
    clickTimesRef.current = clickTimesRef.current.filter((t) => now - t < 2000)
    clickTimesRef.current.push(now)

    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = []

      const pin = window.prompt('Введите PIN-код')
      if (pin === null) return // cancelled
      if (pin === ADMIN_PIN) {
        localStorage.setItem('isAdmin', 'true')
        window.location.href = '/admin'
      } else {
        alert('❌ Неверный PIN-код')
      }
    }
  }, [])

  // ── Loading gate ──
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

  // ── Not subscribed gate ──
  if (notSubscribed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-[22px] font-bold text-text-primary mb-3">Доступ закрыт</h1>
          <p className="text-text-secondary text-[15px] leading-relaxed mb-6">
            Пожалуйста, откройте бота в Telegram, подпишитесь на канал и нажмите «Я подписалась».
          </p>
          <p className="text-text-muted text-[13px]">
            После подписки весь функционал станет доступен автоматически.
          </p>
          {/* DEBUG: show user's tgId and subscription status for verification */}
          <p className="text-xs text-red-400 mt-4 font-mono bg-bg-secondary rounded-lg p-3 break-all">
            DEBUG: ID={debugTgId ?? 'null'}, Sub: {false}
            <br/>
            RAW DATA: {JSON.stringify(debugRawData)}
            <br/>
            DB ERROR: {JSON.stringify(debugDbError)}
          </p>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col bg-bg-primary overflow-hidden">
      <div className="flex flex-col flex-1 px-6 pt-12 pb-10 justify-between">
        <div className="flex flex-col gap-6">
          {/* Heading + body — no image */}
          <motion.div {...fadeUp(0.22)} className="flex flex-col gap-3">
            <h1
              className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary cursor-pointer select-none"
              onClick={handleTitleClick}
            >
              У каждого человека есть внутренняя <span className="text-accent">«опора»</span>
            </h1>
            <p className="text-[15px] leading-[1.6] text-text-secondary opacity-90">
              — способ держать себя в жизни. Часто эта опора искажается. Снаружи это выглядит как характер или привычки, а на деле — устойчивый механизм, который:
            </p>
            <p className="text-[15px] leading-[1.7] text-text-secondary opacity-90">
              — повторяет одни и те же сценарии{'\n'}
              — создаёт одни и те же проблемы{'\n'}
              — не даёт выйти из замкнутого круга
            </p>
            <p className="text-[15px] leading-[1.6] text-text-primary font-medium opacity-90">
              Сейчас ты увидишь, какая опора у тебя доминирует.
            </p>
          </motion.div>

          {/* Meta pills */}
          <motion.div {...fadeUp(0.38)} className="flex gap-2">
            <span className="text-[13px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3.5 py-2 leading-none">
              25 вопросов
            </span>
            <span className="text-[13px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3.5 py-2 leading-none">
              ~5 минут
            </span>
          </motion.div>
        </div>

        {/* CTA button */}
        <motion.div
          {...fadeUp(0.52)}
          className="w-full mt-auto"
        >
          {cooldownDays !== null && cooldownDays > 0 ? (
            <button
              type="button"
              disabled
              className="w-full py-[20px] px-6 bg-bg-tertiary text-text-muted rounded-2xl font-semibold text-[15px] select-none cursor-not-allowed border border-border"
            >
              Опора ещё формируется. Повторный тест будет доступен через {cooldownDays} {cooldownDays === 1 ? 'день' : cooldownDays < 5 ? 'дня' : 'дней'}
            </button>
          ) : (
            <Link href="/test" prefetch={true} className="block w-full">
              <button
                type="button"
                className="w-full py-[20px] px-6 bg-accent text-white rounded-2xl font-semibold text-[17px] tracking-[-0.01em] active:scale-[0.98] transition-all duration-200 select-none shadow-lg shadow-accent/25"
              >
                ✨ Пройти тест
              </button>
            </Link>
          )}
        </motion.div>
      </div>
    </main>
  )
}
