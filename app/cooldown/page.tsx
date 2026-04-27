'use client'

import { motion } from 'framer-motion'
import { useGatekeeper } from '@/components/Gatekeeper'
import { TEXTS } from '@/lib/constants/texts'
import { openAuthorContact } from '@/lib/author-contact'

function getDaysLabel(days: number): string {
  const mod10 = days % 10
  const mod100 = days % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
  return 'дней'
}

export default function CooldownPage() {
  const gatekeeperState = useGatekeeper()
  const cooldownDays = 'cooldownDays' in gatekeeperState ? (gatekeeperState.cooldownDays ?? 0) : 0
  const progressPercent = Math.max(5, Math.min(100, ((60 - cooldownDays) / 60) * 100))

  return (
    <div className="min-h-screen flex flex-col bg-[#0f141a] text-[#dee2ec] font-body-md overflow-x-hidden">
      <main className="flex-1 flex flex-col items-center justify-center px-container-padding">
        <div className="w-full max-w-md flex flex-col items-center text-center space-y-xl">

          {/* Декоративная анимация */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            className="relative w-full aspect-square flex items-center justify-center max-w-[140px]"
          >
            <div className="absolute inset-0 rounded-full border border-[#b0ceb2]/20 animate-pulse" />
            <div className="absolute inset-3 rounded-full border border-[#b0ceb2]/10" />
            <div className="absolute inset-6 rounded-full border border-[#b0ceb2]/5" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-[#b0ceb2]/10 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(176,206,178,0.2)] w-10 h-10">
                <span className="material-symbols-outlined text-[#b0ceb2] text-2xl">hourglass_empty</span>
              </div>
            </div>
          </motion.div>

          {/* Заголовок и цитата */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
            className="space-y-md"
          >
            <h2 className="font-['Newsreader'] text-3xl font-medium text-[#dee2ec]">
              {TEXTS.cooldown.title}
            </h2>
            <p className="font-['Newsreader'] italic text-lg text-[#c2c8c0] leading-relaxed">
              {TEXTS.cooldown.quote}
            </p>
          </motion.div>

          {/* Glass-card с таймером */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
            className="w-full glass-card p-lg rounded-xl space-y-sm flex flex-col items-center"
          >
            <div className="flex items-center justify-center gap-2 text-[#b0ceb2] mb-2">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>calendar_today</span>
            </div>
            <div className="text-xl font-medium text-[#dee2ec] text-center">
              Тест будет доступен снова через{' '}
              <span className="text-[#b0ceb2]">{cooldownDays} {getDaysLabel(cooldownDays)}</span>
            </div>
            <div className="w-full bg-[#30353d] h-1 rounded-full overflow-hidden mt-md">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="bg-[#b0ceb2] h-full rounded-full"
              />
            </div>
          </motion.div>

          {/* Кнопка */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.4 }}
            className="w-full pt-lg"
          >
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

      {/* Декоративные blur-шары */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-[#b0ceb2]/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[-10%] w-64 h-64 bg-[#e2bebe]/10 blur-[100px] rounded-full" />
      </div>
    </div>
  )
}
