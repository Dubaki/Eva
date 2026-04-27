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
    <div className="font-body-md bg-[#0f141a] text-[#dee2ec] min-h-screen flex flex-col selection:bg-[#b0ceb2]/30">
      <main className="flex-1 flex flex-col justify-center px-container-padding max-w-md mx-auto w-full">
        {/* Decorative Visual */}
        <motion.div {...fadeUp(0.1)} className="flex justify-center mb-xl">
          <img 
            alt="Реферальная программа" 
            className="h-[150px] w-auto object-contain rounded-full shadow-2xl shadow-[#b0ceb2]/20" 
            src="/ref.png"
          />
        </motion.div>

        {/* Referral Link Card */}
        <motion.section 
          {...fadeUp(0.2)}
          className="p-lg bg-[#1b2027] rounded-xl border border-[#424842]/30 space-y-md shadow-xl"
        >
          <div className="flex items-center gap-sm">
            <span className="font-label-md text-[#8BA88E] font-bold">
              {TEXTS.referral.subtitle}
            </span>
          </div>

          <div className="relative group">
            <div 
              onClick={() => {
                navigator.clipboard.writeText(referralLink)
              }}
              className="w-full p-md bg-[#30353d] rounded-lg border border-[#8c928b]/20 font-body-sm text-[#c2c8c0] truncate pr-12 cursor-pointer active:bg-[#353941] transition-colors"
            >
              {tgId ? referralLink : 'Загрузка ссылки...'}
            </div>
            {/* Copy Icon Removed per rule */}
          </div>

          <button 
            onClick={handleShare}
            disabled={isSharing || !tgId}
            className="w-full py-md bg-transparent border border-[#e2bebe] text-[#e2bebe] font-label-md rounded-xl hover:bg-[#e2bebe]/10 active:scale-[0.98] transition-all flex items-center justify-center h-14 font-bold"
          >
            {isSharing ? 'Отправляю...' : TEXTS.referral.btnShare}
          </button>

          <div className="pt-sm border-t border-[#424842]/20">
            <div className="flex items-start gap-sm">
              <p className="font-body-sm text-[#8c928b] leading-tight italic">
                {TEXTS.referral.description}
              </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  )
}
