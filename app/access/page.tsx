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
    <div className="font-body-md bg-[#0f141a] text-[#dee2ec] min-h-screen flex flex-col">
      {/* Header Spacer */}
      <header className="flex justify-center items-center h-16 w-full shrink-0">
        <h1 className="font-['Newsreader'] italic text-xl text-[#8BA88E]">EvaTest</h1>
      </header>

      <main className="flex-1 flex flex-col px-container-padding pt-10 pb-32 max-w-lg mx-auto w-full">
        <motion.section {...fadeUp()} className="space-y-xl">
          {/* Decorative Illustration (Sphere) */}
          <div className="flex justify-center py-md">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 bg-[#8BA88E]/20 blur-[60px] rounded-full animate-pulse"></div>
              <div className="relative w-full h-full glass-card rounded-full border border-white/10 flex items-center justify-center overflow-hidden bg-white/5 backdrop-blur-md">
                <div className="w-32 h-32 bg-gradient-to-br from-[#8BA88E]/40 to-[#e2bebe]/40 rounded-full blur-xl opacity-60"></div>
                <span className="material-symbols-outlined text-[#8BA88E] text-6xl relative z-10" style={{ fontVariationSettings: '"FILL" 1' }}>stars</span>
              </div>
            </div>
          </div>

          <div className="space-y-lg">
            <div className="p-lg bg-white/5 rounded-xl border border-white/10 backdrop-blur-md italic">
              <p className="font-body-md text-[#dee2ec]/80 leading-relaxed">
                {TEXTS.accessPage.quote}
              </p>
            </div>

            <p className="font-body-md text-[#dee2ec]/70 px-xs leading-relaxed text-justify">
              {TEXTS.accessPage.body}
            </p>
          </div>

          <div className="pt-md">
            <button 
              onClick={() => router.push('/referral')}
              className="w-full py-md bg-[#8BA88E] text-[#1c3622] font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-[#8BA88E]/10"
            >
              {TEXTS.accessPage.btnGet}
            </button>
          </div>
        </motion.section>

        {/* Visual Accents */}
        <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-[#8BA88E]/5 rounded-full blur-[100px] pointer-events-none"></div>
      </main>
    </div>
  )
}
