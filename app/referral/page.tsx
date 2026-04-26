'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TEXTS } from '@/lib/constants/texts'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

export default function ReferralPage() {
  const [tgId, setTgId] = useState<number | null>(null)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    const WebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
    const id = WebApp?.initDataUnsafe?.user?.id || 999999999
    setTgId(id)
  }, [])

  const handleShare = async () => {
    if (isSharing || !tgId) return
    setIsSharing(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId }),
      })
      const json = await res.json()
      if (res.ok || json.alreadyShared) {
        (window as any).Telegram?.WebApp?.close?.()
      } else {
        alert('Не удалось отправить сообщение. Попробуйте скопировать ссылку вручную.')
      }
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setIsSharing(false)
    }
  }

  const referralLink = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || 'sprosievubot'}?start=ref_${tgId}`

  return (
    <div className="font-body-md bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          {/* Decorative Icon */}
          <div className="flex justify-center py-md">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full"></div>
              <div className="relative w-full h-full glass-card rounded-3xl border border-primary/10 flex items-center justify-center rotate-12">
                <span className="material-symbols-outlined text-primary text-6xl -rotate-12">share</span>
              </div>
            </div>
          </div>

          <div className="p-lg bg-surface-container rounded-xl border border-outline-variant/30 space-y-md shadow-xl">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>stars</span>
              <span className="font-label-md text-primary uppercase tracking-wider">{TEXTS.referral.subtitle}</span>
            </div>

            <div 
              onClick={() => {
                navigator.clipboard.writeText(referralLink)
                // Могли бы добавить Toast здесь
              }}
              className="w-full p-md bg-surface-container-highest rounded-lg border border-outline/20 font-body-sm text-on-surface-variant truncate select-all flex justify-between items-center cursor-pointer active:bg-surface-variant"
            >
              <span className="truncate">{tgId ? referralLink : 'Загрузка ссылки...'}</span>
              <span className="material-symbols-outlined text-sm ml-2">content_copy</span>
            </div>

            <button 
              onClick={handleShare}
              disabled={isSharing || !tgId}
              className="w-full py-md bg-primary text-on-primary font-label-md rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-sm disabled:opacity-50"
            >
              <span>{isSharing ? 'Отправляю...' : TEXTS.referral.btnShare}</span>
              <span className="material-symbols-outlined text-[18px]">share</span>
            </button>

            <p className="font-body-sm text-outline leading-tight text-center italic px-2">
              {TEXTS.referral.description}
            </p>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -bottom-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      </main>
    </div>
  )
}
