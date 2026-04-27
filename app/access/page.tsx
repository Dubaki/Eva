'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { TEXTS } from '@/lib/constants/texts'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

// New design applied from dostup.md
export default function AccessPage() {
  const router = useRouter()

  return (
    <div className="font-body-md bg-[#0f141a] text-[#dee2ec] min-h-screen flex flex-col selection:bg-[#b0ceb2]/30">
      <main className="px-container-padding pb-32 max-w-md mx-auto pt-4">
        {/* Hero Visual Section */}
        <motion.div 
          {...fadeUp(0.1)}
          className="relative w-full aspect-square rounded-xl overflow-hidden shadow-2xl border border-[#424842]/20 mb-4"
        >
          <img 
            alt="Вторая опора" 
            className="w-full h-full object-cover opacity-60" 
            src="/dostup.png"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f141a] via-transparent to-transparent"></div>
          <div className="absolute bottom-md left-md right-md">
            <span className="font-label-sm text-[#b0ceb2] uppercase mb-xs block">
              {TEXTS.accessPage.badge || 'Доступ ко второй опоре'}
            </span>
            <h2 className="font-['Newsreader'] italic text-[32px] text-[#dee2ec] leading-tight">
              {TEXTS.accessPage.title || 'вторая смешенная искаженная опора'}
            </h2>
          </div>
        </motion.div>

        {/* Personal Note Section */}
        <motion.section {...fadeUp(0.2)} className="space-y-md">
          <div className="p-lg bg-[#171c23] rounded-xl border-l-2 border-[#8ba88e]">
            <p className="font-['Newsreader'] italic text-lg text-[#c2c8c0] leading-relaxed">
              {TEXTS.accessPage.quote}
            </p>
          </div>
          
          <p className="font-body-md text-[#c2c8c0]/80 px-xs italic leading-relaxed">
            {TEXTS.accessPage.body}
          </p>

          <button 
            onClick={() => router.push('/referral')}
            className="w-full py-md bg-[#b0ceb2] text-[#1c3622] font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center h-14"
          >
            {TEXTS.accessPage.btnGet}
          </button>
        </motion.section>
      </main>
    </div>
  )
}
