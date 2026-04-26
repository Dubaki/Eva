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
    <div className="font-body-md bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          {/* Decorative Pulsing Circle */}
          <div className="flex justify-center py-md">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 bg-secondary/10 blur-[40px] rounded-full animate-ping"></div>
              <div className="relative w-full h-full glass-card rounded-full border border-outline/10 flex items-center justify-center">
                <div className="w-24 h-24 bg-surface-container-highest rounded-full flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-secondary text-5xl">psychology</span>
                </div>
              </div>
            </div>
          </div>

          <h2 className="font-headline-lg text-headline-lg text-on-surface text-center">
            {TEXTS.mechanism.title}
          </h2>

          <div className="p-lg bg-surface-container rounded-xl border border-outline-variant/30 space-y-md italic">
            <p className="font-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {TEXTS.mechanism.quote}
            </p>
          </div>

          <p className="font-body-md text-on-surface-variant/80 px-xs leading-relaxed text-justify">
            {TEXTS.mechanism.body}
          </p>

          <div className="space-y-md pt-md">
            <button 
              onClick={() => router.push('/access')}
              className="w-full py-md bg-primary text-on-primary font-label-md rounded-xl active:scale-95 transition-transform shadow-lg shadow-primary/10"
            >
              {TEXTS.mechanism.btnNow}
            </button>
            <button 
              onClick={() => (window as any).Telegram?.WebApp?.close?.()}
              className="w-full py-md text-outline font-label-md rounded-xl active:scale-95 transition-transform"
            >
              {TEXTS.mechanism.btnLater}
            </button>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      </main>
    </div>
  )
}
