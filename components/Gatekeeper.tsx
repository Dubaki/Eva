'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getStoredInviterTgId } from '@/components/providers/AuthProvider'
import { TEXTS } from '@/lib/constants/texts'

const CHANNEL_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ?? 'https://t.me/sprosievu'

export type GatekeeperState =
  | { checking: true }
  | { checking: false; blocked: true; reason: 'not_subscribed' | 'no_webapp'; cooldownDays?: number }
  | { checking: false; blocked: false; cooldownDays?: number; lastTestDate?: string | null }

const GatekeeperContext = createContext<GatekeeperState>({ checking: true })
export const useGatekeeper = () => useContext(GatekeeperContext)

export default function Gatekeeper({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GatekeeperState>({ checking: true })
  const [confirmingSub, setConfirmingSub] = useState(false)
  const [subError, setSubError] = useState<string | null>(null)
  const router = useRouter()

  const check = useCallback(async () => {
    // 0. Bypass for admin routes
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      setState({ checking: false, blocked: false, cooldownDays: 0, lastTestDate: null })
      return
    }

    const WebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
    
    if (WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#0f141a');
      WebApp.setBackgroundColor('#0f141a');
    }

    const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? null
    const initData = WebApp?.initData
    const startParam = WebApp?.initDataUnsafe?.start_param

    if (!currentTgId) {
      if (process.env.NODE_ENV === 'development') {
         setState({ checking: false, blocked: false, cooldownDays: 0, lastTestDate: null })
         return
      }
      setState({ checking: false, blocked: true, reason: 'no_webapp' })
      return
    }

    try {
      // 1. Авторизация (UPSERT профиля + получение JWT)
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, startParam }),
      })
      const authJson = await authRes.json()
      if (authJson.success && authJson.data?.token) {
        localStorage.setItem('eva_token', authJson.data.token)
      }

      // 2. Проверка статуса
      const res = await fetch(`/api/user/status?tg_id=${currentTgId}`)
      const json = await res.json()

      if (json.isSubscribed === false) {
        setState({ checking: false, blocked: true, reason: 'not_subscribed' })
        return
      }

      const cooldown = json.cooldownDays ?? 0
      if (cooldown > 0) {
        setState({ checking: false, blocked: false, cooldownDays: cooldown, lastTestDate: json.lastTestDate })
        router.replace('/cooldown')
        return
      }

      setState({ 
        checking: false, 
        blocked: false, 
        cooldownDays: 0, 
        lastTestDate: json.lastTestDate 
      })
    } catch (err) {
      console.error('[gatekeeper] check error:', err)
      setState({ checking: false, blocked: true, reason: 'not_subscribed' })
    }
  }, [router])

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
        setSubError(json.error === 'not_subscribed' ? TEXTS.gatekeeper.errorNotSubscribed : (json.error || 'Ошибка проверки'))
      }
    } catch {
      setSubError('Ошибка сети')
    }
    setConfirmingSub(false)
  }, [check])

  if (state.checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <motion.div 
          className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full" 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} 
        />
      </main>
    )
  }

  if (state.blocked) {
    if (state.reason === 'not_subscribed') {
      return (
        <div className="min-h-screen flex flex-col font-body-md bg-background text-on-background">
          <main className="flex-grow flex flex-col items-center justify-center px-container-padding py-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm flex flex-col items-center text-center space-y-xl"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                <div className="relative glass-card w-32 h-32 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-outline/10">
                  <span className="material-symbols-outlined text-primary text-6xl" style={{ fontVariationSettings: '"FILL" 1' }}>lock</span>
                </div>
              </div>

              <div className="space-y-md">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">{TEXTS.gatekeeper.title}</h1>
                <p className="font-body-md text-body-md text-on-surface-variant px-2 leading-relaxed">
                  {TEXTS.gatekeeper.subtitle}
                </p>
                {subError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-error font-label-sm">
                    {subError}
                  </motion.p>
                )}
              </div>

              <div className="w-full space-y-md pt-md">
                <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <button className="w-full h-[56px] bg-primary-container text-on-primary-container rounded-xl font-label-md flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg">
                    <span>{TEXTS.gatekeeper.btnSubscribe}</span>
                    <span className="material-symbols-outlined text-lg">open_in_new</span>
                  </button>
                </a>
                <button 
                  onClick={handleConfirmSubscription}
                  disabled={confirmingSub}
                  className="w-full h-[56px] border border-secondary text-secondary rounded-xl font-label-md active:scale-95 duration-200 disabled:opacity-50"
                >
                  {confirmingSub ? 'Проверка...' : TEXTS.gatekeeper.btnConfirm}
                </button>
              </div>

              <p className="font-label-sm text-label-sm text-outline px-4 leading-relaxed">
                {TEXTS.gatekeeper.footer}
              </p>
            </motion.div>
          </main>
          
          <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="fixed -top-20 -right-20 w-64 h-64 bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>
        </div>
      )
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm space-y-4">
          <span className="material-symbols-outlined text-6xl text-primary">cloud_off</span>
          <h1 className="font-headline-md text-on-surface">Откройте через Telegram</h1>
          <p className="font-body-md text-on-surface-variant">Приложение работает только внутри Telegram-бота.</p>
        </div>
      </main>
    )
  }

  return <GatekeeperContext.Provider value={state}>{children}</GatekeeperContext.Provider>
}
