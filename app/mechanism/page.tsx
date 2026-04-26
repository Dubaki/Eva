'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import EvaHeader from '@/components/EvaHeader'
import { TEXTS } from '@/lib/constants/texts'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

export default function MechanismPage() {
  const router = useRouter()

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      (window as any).Telegram?.WebApp?.close?.()
    }
  }

  return (
    <div className="font-body-md bg-background text-on-background min-h-screen flex flex-col">
      <EvaHeader />

      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl text-center">
          <div className="glass-card p-lg rounded-xl border-l-4 border-primary text-left shadow-lg">
            <p className="font-headline-md italic leading-relaxed text-on-surface-variant">
              {TEXTS.mechanism.quote}
            </p>
          </div>

          <p className="font-body-md text-on-surface-variant leading-relaxed text-justify italic">
            {TEXTS.mechanism.body}
          </p>

          <div className="w-full flex flex-col items-center space-y-md pt-md">
            <button 
              onClick={() => router.push('/access')}
              className="w-full h-14 bg-primary-container text-on-primary-container font-label-md rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-wider flex items-center justify-center"
            >
              {TEXTS.mechanism.btnNow}
            </button>
            <button 
              onClick={handleClose}
              className="w-full h-14 border border-secondary text-secondary font-label-md rounded-xl active:scale-95 transition-all uppercase tracking-wider flex items-center justify-center"
            >
              {TEXTS.mechanism.btnLater}
            </button>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -top-20 -right-20 w-64 h-64 bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>
      </main>
    </div>
  )
}
