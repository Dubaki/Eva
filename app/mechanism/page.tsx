'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { TEXTS } from '@/lib/constants/texts'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

export default function MechanismPage() {
  const router = useRouter()

  return (
    <div className="font-body-md bg-[#0f141a] text-[#dee2ec] min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          <h2 className="font-headline-lg text-headline-lg text-[#dee2ec] text-center">
            {TEXTS.mechanism.title}
          </h2>

          <div className="p-lg bg-white/5 rounded-xl border border-white/10 space-y-md italic">
            <p className="font-body-md text-[#dee2ec]/80 leading-relaxed whitespace-pre-wrap">
              {TEXTS.mechanism.quote}
            </p>
          </div>

          <p className="font-body-md text-[#dee2ec]/70 px-xs leading-relaxed text-justify">
            {TEXTS.mechanism.description}
          </p>

          <div className="space-y-md pt-md">
            <button 
              onClick={() => router.push('/access')}
              className="w-full py-md bg-[#8BA88E] text-[#1c3622] font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-[#8BA88E]/10"
            >
              {TEXTS.mechanism.btnGetSecondNow}
            </button>
            <button 
              onClick={() => (window as any).Telegram?.WebApp?.close?.()}
              className="w-full py-md text-[#dee2ec]/50 font-bold rounded-xl active:scale-95 transition-transform"
            >
              {TEXTS.mechanism.btnWaitTwoMonths}
            </button>
          </div>
        </motion.section>
      </main>
    </div>
  )
}
