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

export default function AccessPage() {
  const router = useRouter()

  return (
    <div className="font-body-md bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          <div className="p-lg bg-surface-container-low rounded-xl border-l-2 border-primary-container shadow-sm">
            <p className="font-headline-md italic text-on-surface-variant leading-relaxed">
              {TEXTS.access.quote}
            </p>
          </div>

          <p className="font-body-md text-on-surface-variant/80 px-xs italic leading-relaxed text-justify">
            {TEXTS.access.body}
          </p>

          <div className="pt-md">
            <button 
              onClick={() => router.push('/referral')}
              className="w-full py-md bg-primary text-on-primary font-label-md rounded-xl active:scale-95 transition-transform shadow-lg shadow-primary/10 flex items-center justify-center gap-2"
            >
              <span>{TEXTS.access.btnGet}</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      </main>
    </div>
  )
}
