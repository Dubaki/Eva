'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { motion } from 'framer-motion'
import { getStoredInviterTgId } from '@/components/providers/AuthProvider'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000 

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
    const WebApp = typeof window !== 'undefined'
      ? (window as any).Telegram?.WebApp
      : null
    const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? null

    // АБСОЛЮТНАЯ БЛОКИРОВКА ЕСЛИ НЕТ ID (Уязвимость закрыта)
    if (!currentTgId) {
      console.warn('[Gatekeeper] No WebApp tgId — blocked')
      const newState: GatekeeperState = { checking: false, blocked: true, reason: 'no_webapp' }
      setState(newState)
      onStatus?.(newState)
      return
    }

    const isTester = TESTER_IDS.includes(String(currentTgId))
    if (isTester) {
      const newState: GatekeeperState = { checking: false, blocked: false }
      setState(newState)
      onStatus?.(newState)
      return
    }

    try {
      const res = await fetch(`/api/user/status?tg_id=${currentTgId}`)
      const json = await res.json()

      if (!json.success) {
        const newState: GatekeeperState = { checking: false, blocked: true, reason: 'not_subscribed' }
        setState(newState)
        onStatus?.(newState)
        return
      }

      const { isSubscribed, lastTestDate } = json.data

      if (!isSubscribed) {
        const newState: GatekeeperState = { checking: false, blocked: true, reason: 'not_subscribed' }
        setState(newState)
        onStatus?.(newState)
        return
      }

      let daysLeft = 0
      if (lastTestDate) {
        const elapsed = Date.now() - new Date(lastTestDate).getTime()
        if (elapsed < COOLDOWN_MS) {
          daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
        }
      }

      const newState: GatekeeperState = { checking: false, blocked: false, cooldownDays: daysLeft, lastTestDate }
      setState(newState)
      onStatus?.(newState)
    } catch (err) {
      const newState: GatekeeperState = { checking: false, blocked: true, reason: 'not_subscribed' }
      setState(newState)
      onStatus?.(newState)
    }
  }, [onStatus])

  useEffect(() => {
    check()
  }, [check])

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
        await check() // Перепроверяем статус и пускаем в приложение
      } else {
        const errMsg = json.error === 'not_subscribed'
          ? 'Подписка не найдена. Пожалуйста, подпишитесь на канал и попробуйте снова.'
          : (json.error || 'Произошла ошибка. Попробуйте ещё раз.')
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm w-full">
            <p className="text-4xl mb-4">🔒</p>
            <h1 className="text-[22px] font-bold text-text-primary mb-3">Доступ закрыт</h1>
            <p className="text-text-secondary text-[15px] leading-relaxed mb-6">
              Пожалуйста, подпишитесь на канал автора, чтобы получить доступ к приложению.
            </p>
            {subError && <p className="text-red-400 text-[13px] mb-4">{subError}</p>}
            <div className="flex flex-col gap-3">
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
              <p className="text-text-muted text-[13px]">После подписки функционал станет доступен.</p>
            </div>
          </motion.div>
        </main>
      )
    }

    const msg = state.reason === 'cooldown' ? {
      title: 'Тест ещё не доступен', message: `Следующий тест будет доступен через ${state.cooldownDays} дн.`, hint: 'Это нужно для точности.'
    } : {
      title: 'Откройте через Telegram', message: 'Это приложение работает только внутри Telegram. Откройте бота.', hint: 'Найдите бота в Telegram.'
    }

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