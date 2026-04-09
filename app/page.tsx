'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut', delay },
})

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-bg-primary overflow-hidden">
      {/* Welcome image — restricted height, covers top */}
      <motion.div {...fadeUp(0.05)} className="relative w-full h-[35vh] shrink-0">
        <Image
          src="/hero.png"
          alt="EVA Welcome"
          fill
          priority={true}
          className="object-cover rounded-b-[32px]"
        />
      </motion.div>

      <div className="flex flex-col flex-1 px-6 pt-8 pb-10 justify-between">
        <div className="flex flex-col gap-6">
          {/* Heading + body */}
          <motion.div {...fadeUp(0.22)} className="flex flex-col gap-3">
            <h1 className="text-[28px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary">
              У каждого человека есть внутренняя{' '}
              <span className="text-accent">«опора»</span>
            </h1>
            <p className="text-[16px] leading-[1.6] text-text-secondary opacity-90">
              Этот короткий тест покажет механизм, через который ты сейчас живёшь.
            </p>
          </motion.div>

          {/* Meta pills */}
          <motion.div {...fadeUp(0.38)} className="flex gap-2">
            <span className="text-[13px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3.5 py-2 leading-none">
              25 вопросов
            </span>
            <span className="text-[13px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3.5 py-2 leading-none">
              ~5 минут
            </span>
          </motion.div>
        </div>

        {/* CTA button — with extra air above */}
        <motion.div
          {...fadeUp(0.52)}
          className="w-full mt-auto"
        >
          <Link href="/test" prefetch={true} className="block w-full">
            <button
              type="button"
              className="w-full py-[20px] px-6 bg-accent text-white rounded-2xl font-semibold text-[17px] tracking-[-0.01em] active:scale-[0.98] transition-all duration-200 select-none shadow-lg shadow-accent/25"
            >
              ✨ Пройти тест
            </button>
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
