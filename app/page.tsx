'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { TEXTS } from '@/lib/constants/texts'
import { useGatekeeper } from '@/components/Gatekeeper'
import { openAuthorContact } from '@/lib/author-contact'

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

export default function Home() {
  const gatekeeperState = useGatekeeper()
  const cooldownDays = 'cooldownDays' in gatekeeperState ? (gatekeeperState.cooldownDays ?? 0) : 0

  if (cooldownDays > 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-on-background font-body-md overflow-x-hidden">
        <main className="flex-1 flex flex-col items-center px-container-padding pt-10 pb-32">
          <div className="w-full max-w-md flex flex-col items-center text-center space-y-xl">
            <motion.div {...fadeUp(0.1)} className="relative w-full aspect-square flex items-center justify-center max-w-[140px]">
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse"></div>
              <div className="absolute inset-3 rounded-full border border-primary/10"></div>
              <div className="absolute inset-6 rounded-full border border-primary/5"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-primary/10 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(139,168,142,0.2)] w-10 h-10">
                  <span className="material-symbols-outlined text-primary text-2xl">hourglass_empty</span>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.2)} className="space-y-md">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">{TEXTS.cooldown.title}</h2>
              <p className="font-body-lg text-on-surface-variant leading-relaxed font-headline-md italic opacity-90">
                {TEXTS.cooldown.quote}
              </p>
            </motion.div>

            <motion.div {...fadeUp(0.3)} className="w-full glass-card p-lg rounded-xl space-y-sm flex flex-col items-center">
              <div className="flex items-center justify-center gap-2 text-primary mb-2">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              </div>
              <div className="text-headline-md font-headline-md text-on-surface">
                {TEXTS.cooldown.cardTemplate(cooldownDays)}
              </div>
              <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden mt-md">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.max(5, (cooldownDays / 60) * 100)}%` }}
                ></div>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.4)} className="w-full pt-lg">
              <button 
                onClick={() => openAuthorContact()}
                className="w-full bg-primary-container text-on-primary-container font-label-md py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
              >
                <span className="material-symbols-outlined">chat_bubble</span>
                {TEXTS.cooldown.btnContact}
              </button>
            </motion.div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[#0f141a] text-[#dee2ec] min-h-screen flex flex-col font-body-md overflow-x-hidden">
      <main className="flex-1 flex flex-col px-container-padding max-w-lg mx-auto w-full pb-32 pt-2">
        {/* Main Narrative Card */}
        <motion.section 
          {...fadeUp(0.1)}
          className="bg-[rgba(27,32,39,0.6)] backdrop-blur-[12px] border border-[rgba(140,146,139,0.1)] rounded-xl p-md shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden mt-md"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-[#8ba88e]"></div>
          <div className="flex flex-col gap-sm">
            <p className="font-['Newsreader'] italic text-lg text-[#dee2ec]/90 leading-tight">
              {TEXTS.start.part1}
            </p>
            <div className="space-y-xs text-[#c2c8c0] text-sm leading-snug">
              <p>{TEXTS.start.part2}</p>
              <ul className="space-y-0 list-none pl-2 border-l border-[#424842]/50">
                {TEXTS.start.items.map((item, i) => (
                  <li key={i} className="flex gap-2 items-start italic">
                    <span className="text-[#b0ceb2]">—</span> {item.replace('— ', '')}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-[#b0ceb2] font-medium leading-tight">
              {TEXTS.start.part3}
            </p>
          </div>
        </motion.section>

        {/* Visual Anchor / Decorative Image */}
        <motion.div 
          {...fadeUp(0.2)}
          className="w-full rounded-xl overflow-hidden relative grayscale opacity-80 h-48 my-md"
        >
          <Image 
            alt="abstract" 
            className="object-cover" 
            src="/115.png" 
            fill
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f141a] to-transparent"></div>
        </motion.div>

        {/* Stats Bento Grid */}
        <section className="grid grid-cols-2 gap-md mt-md">
          <motion.div 
            {...fadeUp(0.3)}
            className="bg-[#1b2027] rounded-xl py-sm px-md flex flex-col gap-xs items-center text-center border border-[#424842]/20"
          >
            <span className="material-symbols-outlined text-[#e9c349]">quiz</span>
            <div>
              <div className="text-[#dee2ec] font-bold text-lg leading-tight">{TEXTS.start.stat1}</div>
              <div className="text-[#c2c8c0] font-label-md uppercase tracking-wider text-[10px]">{TEXTS.start.stat1sub}</div>
            </div>
          </motion.div>
          <motion.div 
            {...fadeUp(0.4)}
            className="bg-[#1b2027] rounded-xl py-sm px-md flex flex-col gap-xs items-center text-center border border-[#424842]/20"
          >
            <span className="material-symbols-outlined text-[#e2bebe]">schedule</span>
            <div>
              <div className="text-[#dee2ec] font-bold text-lg leading-tight">{TEXTS.start.stat2}</div>
              <div className="text-[#c2c8c0] font-label-md uppercase tracking-wider text-[10px]">{TEXTS.start.stat2sub}</div>
            </div>
          </motion.div>
        </section>

        {/* Instructions Section */}
        <motion.section 
          {...fadeUp(0.5)}
          className="flex flex-col gap-sm mt-md"
        >
          <h3 className="font-label-md text-[#cceace] uppercase tracking-widest flex items-center gap-2 text-[10px] font-bold">
            <span className="w-8 h-px bg-[#cceace]"></span> {TEXTS.start.instructionTitle}
          </h3>
          <div className="bg-[#5a4041]/10 border-l-2 border-[#e2bebe] rounded-r-lg p-md">
            <p className="text-[#c2c8c0] leading-relaxed italic text-[13px] text-justify px-2">
              {TEXTS.start.instruction}
            </p>
          </div>
        </motion.section>
      </main>

      {/* Bottom Action Container */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="fixed bottom-0 left-0 w-full p-container-padding bg-gradient-to-t from-[#0f141a] via-[#0f141a]/90 to-transparent z-40"
      >
        <Link href="/test" className="block w-full">
          <button className="w-full h-14 bg-[#b0ceb2] text-[#1c3622] font-bold text-lg rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform duration-150">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>play_arrow</span>
            {TEXTS.start.btnStart}
          </button>
        </Link>
      </motion.div>
    </div>
  )
}
