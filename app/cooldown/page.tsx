'use client'

import { motion } from 'framer-motion'
import { useGatekeeper } from '@/components/Gatekeeper'
import { TEXTS } from '@/lib/constants/texts'
import { openAuthorContact } from '@/lib/author-contact'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

export default function CooldownPage() {
  const gatekeeperState = useGatekeeper()
  const cooldownDays = 'cooldownDays' in gatekeeperState ? (gatekeeperState.cooldownDays ?? 0) : 0

  return (
    <div className="min-h-screen flex flex-col bg-[#0f141a] text-[#dee2ec] font-body-md overflow-x-hidden">
      <main className="flex-1 flex flex-col items-center px-container-padding pt-10 pb-32">
        <div className="w-full max-w-md flex flex-col items-center text-center space-y-xl">
          {/* Decorative Animation */}
          <motion.div {...fadeUp(0.1)} className="relative w-full aspect-square flex items-center justify-center max-w-[140px]">
            <div className="absolute inset-0 rounded-full border border-[#8BA88E]/20 animate-pulse"></div>
            <div className="absolute inset-3 rounded-full border border-[#8BA88E]/10"></div>
            <div className="absolute inset-6 rounded-full border border-[#8BA88E]/5"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-[#8BA88E]/10 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(139,168,142,0.2)] w-10 h-10">
                <span className="material-symbols-outlined text-[#b0ceb2] text-2xl">hourglass_empty</span>
              </div>
            </div>
          </motion.div>

          {/* Title & Quote */}
          <motion.div {...fadeUp(0.2)} className="space-y-md">
            <h2 className="font-['Newsreader'] italic text-3xl text-[#dee2ec]">{TEXTS.cooldown.title}</h2>
            <p className="font-body-md text-[#dee2ec]/70 leading-relaxed italic px-4">
              {TEXTS.cooldown.quote}
            </p>
          </motion.div>

          {/* Cooldown Card */}
          <motion.div {...fadeUp(0.3)} className="w-full glass-card p-lg rounded-xl space-y-sm flex flex-col items-center border border-white/10 bg-white/5 backdrop-blur-md">
            <div className="flex items-center justify-center gap-2 text-[#b0ceb2] mb-2">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>calendar_today</span>
            </div>
            <div className="text-xl font-medium text-[#dee2ec] text-center">
              {TEXTS.cooldown.progressTemplate(cooldownDays)}
            </div>
            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-md">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(5, (cooldownDays / 60) * 100)}%` }}
                className="bg-[#b0ceb2] h-full rounded-full transition-all duration-1000"
              />
            </div>
          </motion.div>

          {/* Action Button */}
          <motion.div {...fadeUp(0.4)} className="w-full pt-lg">
            <button
              onClick={() => openAuthorContact()}
              className="w-full bg-[#8ba88e] text-[#233d29] font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat_bubble</span>
              {TEXTS.cooldown.btnContact}
            </button>
          </motion.div>
        </div>
      </main>
      
      {/* Background Accents */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-[#8BA88E]/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-64 h-64 bg-[#e2bebe]/10 blur-[100px] rounded-full"></div>
      </div>
    </div>
  )
}
