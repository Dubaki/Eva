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
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, startParam }),
      })
      const authJson = await authRes.json()
      if (authJson.success && authJson.data?.token) {
        localStorage.setItem('eva_token', authJson.data.token)
      }

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
        setSubError(json.error === 'not_subscribed' ? TEXTS.access.error : (json.error || 'Ошибка проверки'))
      }
    } catch {
      setSubError('Ошибка сети')
    }
    setConfirmingSub(false)
  }, [check])

  if (state.checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f141a]">
        <motion.div 
          className="w-10 h-10 border-2 border-[#8BA88E] border-t-transparent rounded-full" 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} 
        />
      </main>
    )
  }

  if (state.blocked) {
    if (state.reason === 'not_subscribed') {
      return (
        <div className="min-h-screen flex flex-col font-body-md bg-[#0f141a] text-[#dee2ec]">
          {/* Header Spacer */}
          <header className="flex justify-center items-center h-16 w-full shrink-0">
            <h1 className="font-['Newsreader'] italic text-xl text-[#8BA88E]">EvaTest</h1>
          </header>

          <main className="flex-grow flex flex-col items-center justify-center px-container-padding py-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm flex flex-col items-center text-center space-y-xl"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[#8BA88E]/20 blur-3xl rounded-full"></div>
                <div className="relative glass-card w-32 h-32 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-white/10 backdrop-blur-md">
                  <span className="material-symbols-outlined text-[#8BA88E] text-6xl" style={{ fontVariationSettings: '"FILL" 1' }}>lock</span>
                </div>
              </div>

              <div className="space-y-md px-4">
                <h1 className="font-['Newsreader'] italic text-3xl text-[#dee2ec]">{TEXTS.access.title}</h1>
                <p className="font-body-md text-[#dee2ec]/70 leading-relaxed text-center">
                  {TEXTS.access.description}
                </p>
                {subError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 font-label-sm">
                    {subError}
                  </motion.p>
                )}
              </div>

              <div className="w-full space-y-md pt-md">
                <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <button className="w-full h-[56px] bg-[#8BA88E] text-[#1c3622] rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg shadow-[#8BA88E]/10">
                    <span>{TEXTS.access.btnSubscribe}</span>
                  </button>
                </a>
                <button 
                  onClick={handleConfirmSubscription}
                  disabled={confirmingSub}
                  className="w-full h-[56px] border border-[#8BA88E]/30 text-[#8BA88E] rounded-xl font-bold active:scale-95 duration-200 disabled:opacity-50"
                >
                  {confirmingSub ? 'Проверка...' : TEXTS.access.btnConfirm}
                </button>
              </div>

              <p className="font-label-sm text-[#dee2ec]/40 px-4 leading-relaxed italic text-[12px]">
                {TEXTS.access.footer}
              </p>
            </motion.div>
          </main>
          
          <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-[#8BA88E]/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="fixed -top-20 -right-20 w-64 h-64 bg-[#e2bebe]/5 rounded-full blur-[100px] pointer-events-none"></div>
        </div>
      )
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f141a] px-6 text-[#dee2ec]">
        <div className="text-center max-w-sm space-y-4">
          <span className="material-symbols-outlined text-6xl text-[#8BA88E]">cloud_off</span>
          <h1 className="font-['Newsreader'] italic text-2xl">Откройте через Telegram</h1>
          <p className="text-[#dee2ec]/60">Приложение работает только внутри Telegram-бота.</p>
        </div>
      </main>
    )
  }

  return <GatekeeperContext.Provider value={state}>{children}</GatekeeperContext.Provider>
}
