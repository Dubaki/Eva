'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import EvaHeader from '@/components/EvaHeader'
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
    const WebApp = (window as any).Telegram?.WebApp
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
      if (res.ok) {
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
      <EvaHeader />

      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          <div className="p-lg bg-surface-container rounded-xl border border-outline-variant/30 space-y-md shadow-xl">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>stars</span>
              <span className="font-label-md text-primary uppercase tracking-wider">{TEXTS.referral.subtitle}</span>
            </div>

            <div className="w-full p-md bg-surface-container-highest rounded-lg border border-outline/20 font-body-sm text-on-surface-variant truncate select-all">
              {tgId ? referralLink : 'Загрузка ссылки...'}
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
              {TEXTS.referral.body}
            </p>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -bottom-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      </main>
    </div>
  )
}
