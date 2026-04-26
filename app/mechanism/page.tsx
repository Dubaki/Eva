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
      {/* Header EvaTest according to LOGIC.md */}
      <header className="flex justify-center items-center h-16 w-full shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#8BA88E] text-2xl">spa</span>
          <h1 className="font-['Newsreader'] italic text-xl text-[#8BA88E]">EvaTest</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          {/* Decorative Pulsing Circle - simplified */}
          <div className="flex justify-center py-md">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 bg-[#8BA88E]/10 blur-[40px] rounded-full"></div>
              <div className="relative w-full h-full glass-card rounded-full border border-white/10 flex items-center justify-center">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#8BA88E] text-5xl">psychology</span>
                </div>
              </div>
            </div>
          </div>

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
