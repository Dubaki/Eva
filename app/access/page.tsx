'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { TEXTS } from '@/lib/constants/texts'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

export default function AccessPage() {
  const router = useRouter()

  return (
    <div className="font-body-md bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          {/* Decorative Illustration (Sphere) */}
          <div className="flex justify-center py-md">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse"></div>
              <div className="relative w-full h-full glass-card rounded-full border border-primary/20 flex items-center justify-center overflow-hidden">
                <div className="w-32 h-32 bg-gradient-to-br from-primary/40 to-secondary/40 rounded-full blur-xl opacity-60"></div>
                <span className="material-symbols-outlined text-primary text-6xl relative z-10" style={{ fontVariationSettings: '"FILL" 1' }}>stars</span>
              </div>
            </div>
          </div>

          <div className="space-y-lg">
            <div className="p-lg bg-surface-container rounded-xl border border-outline-variant/30 italic">
              <p className="font-body-md text-on-surface-variant leading-relaxed">
                {TEXTS.access.quote}
              </p>
            </div>

            <p className="font-body-md text-on-surface-variant/80 px-xs leading-relaxed text-justify">
              {TEXTS.access.body}
            </p>
          </div>

          <div className="pt-md">
            <button 
              onClick={() => router.push('/referral')}
              className="w-full py-md bg-primary text-on-primary font-label-md rounded-xl active:scale-95 transition-transform shadow-lg shadow-primary/10"
            >
              {TEXTS.access.btnGet}
            </button>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      </main>
    </div>
  )
}
