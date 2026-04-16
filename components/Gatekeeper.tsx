'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { motion } from 'framer-motion'
import { getStoredInviterTgId } from '@/components/providers/AuthProvider'

const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000
const CHANNEL_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ?? 'https://t.me/sprosievu'

export type GatekeeperState =
  | { checking: true }
  | { checking: false; blocked: true; reason: 'not_subscribed' | 'cooldown' | 'no_webapp'; cooldownDays?: number }
  | { checking: false; blocked: false; cooldownDays?: number; lastTestDate?: string | null }

const GatekeeperContext = createContext<GatekeeperState>({ checking: true })
export const useGatekeeper = () => useContext(GatekeeperContext)

export default function Gatekeeper({ children, onStatus }: { children: React.ReactNode; onStatus?: (status: GatekeeperState) => void }) {
  const [state, setState] = useState<GatekeeperState>({ checking: true })
  const [confirmingSub, setConfirmingSub] = useState(false)
  const [subError, setSubError] = useState<string | null>(null)

  const check = useCallback(async () => {
    const WebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
    const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? null

    if (!currentTgId) {
      const newState: GatekeeperState = { checking: false, blocked: true, reason: 'no_webapp' }
      setState(newState)
      onStatus?.(newState)
      return
    }

    try {
      const res = await fetch(`/api/user/status?tg_id=${currentTgId}`)
      const json = await res.json()

      if (!json.success || !json.data?.isSubscribed) {
        const newState: GatekeeperState = { checking: false, blocked: true, reason: 'not_subscribed' }
        setState(newState)
        onStatus?.(newState)
        return
      }

      let daysLeft = 0
      if (json.data?.lastTestDate) {
        const elapsed = Date.now() - new Date(json.data.lastTestDate).getTime()
        if (elapsed < COOLDOWN_MS) {
          daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
        }
      }

      const newState: GatekeeperState = { checking: false, blocked: false, cooldownDays: daysLeft, lastTestDate: json.data.lastTestDate }
      setState(newState)
      onStatus?.(newState)
    } catch (err) {
      const newState: GatekeeperState = { checking: false, blocked: true, reason: 'not_subscribed' }
      setState(newState)
      onStatus?.(newState)
    }
  }, [onStatus])

  useEffect(() => { check() }, [check])

  const handleConfirmSubscription = useCallback(async () => {
    setConfirmingSub(true)
    setSubError(null)

    const WebApp = (window as any).Telegram?.WebApp
    const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? null

    if (!currentTgId) {
      setSubError('Не удалось определить ваш Telegram ID')
      setConfirmingSub(false)
      return
    }

    const inviterTgId = getStoredInviterTgId()

    try {
      const res = await fetch('/api/subscription/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: currentTgId, inviterTgId }),
      })

      const json = await res.json()

      if (json.success) {
        await check()
      } else {
        const errMsg = json.error === 'not_subscribed'
          ? 'Подписка не найдена. Пожалуйста, подпишитесь на канал и попробуйте снова.'
          : (json.error || 'Произошла ошибка проверки.')
        setSubError(errMsg)
      }
    } catch {
      setSubError('Ошибка сети. Проверьте интернет-соединение.')
    }
    setConfirmingSub(false)
  }, [check])

  if (state.checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary">
        <motion.div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </main>
    )
  }

  if (state.blocked) {
    if (state.reason === 'not_subscribed') {
      return (
        <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
            <p className="text-4xl mb-4">🔒</p>
            <h1 className="text-[22px] font-bold text-text-primary mb-3">Доступ закрыт</h1>
            <p className="text-text-secondary text-[15px] leading-relaxed mb-6">
              Пожалуйста, подпишитесь на канал автора, чтобы получить доступ к приложению.
            </p>
            {subError && <p className="text-red-400 text-[13px] mb-4">{subError}</p>}
            <div className="flex flex-col gap-3">
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="w-full">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  📢 Подписаться
                </motion.button>
              </a>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={confirmingSub}
                onClick={handleConfirmSubscription}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {confirmingSub ? 'Проверяю…' : '✅ Я подписалась'}
              </motion.button>
              <p className="text-text-muted text-[13px]">После подписки весь функционал станет доступен.</p>
            </div>
          </motion.div>
        </main>
      )
    }

    const msg = state.reason === 'cooldown' 
      ? { title: 'Тест ещё не доступен', message: `Следующий тест будет доступен через ${state.cooldownDays} дн.`, hint: 'Это нужно для точности результатов.' }
      : { title: 'Откройте через Telegram', message: 'Приложение работает только внутри Telegram.', hint: 'Найдите бота и запустите его.' }

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="text-[22px] font-bold text-text-primary mb-3">{msg.title}</h1>
          <p className="text-text-secondary text-[15px] leading-relaxed mb-6">{msg.message}</p>
          <p className="text-text-muted text-[13px]">{msg.hint}</p>
        </motion.div>
      </main>
    )
  }

  return <GatekeeperContext.Provider value={state}>{children}</GatekeeperContext.Provider>
}