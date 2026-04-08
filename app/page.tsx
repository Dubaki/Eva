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
    <main className="flex min-h-screen flex-col bg-bg-primary px-5">
      <div className="flex-1" />

      <div className="flex flex-col gap-7 max-w-sm mx-auto w-full">

        {/* Welcome image */}
        <motion.div {...fadeUp(0.05)}>
          <Image
            src="/hero.png"
            alt="EVA Welcome"
            width={350}
            height={350}
            priority={true}
            className="mx-auto mb-6 rounded-2xl"
          />
        </motion.div>

        {/* Heading + body */}
        <motion.div {...fadeUp(0.22)} className="flex flex-col gap-4">
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-text-primary">
            У каждого человека есть внутренняя{' '}
            <span className="text-accent">«опора»</span>
          </h1>
          <p className="text-[16px] leading-[1.65] text-text-secondary">
            Этот короткий тест покажет механизм, через который ты сейчас живёшь.
          </p>
        </motion.div>

        {/* Meta pills */}
        <motion.div {...fadeUp(0.38)} className="flex gap-2">
          <span className="text-[13px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3 py-1.5 leading-none">
            25 вопросов
          </span>
          <span className="text-[13px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3 py-1.5 leading-none">
            ~5 минут
          </span>
        </motion.div>
      </div>

      <div className="flex-[0.6]" />

      {/* CTA button */}
      <motion.div
        {...fadeUp(0.52)}
        className="max-w-sm mx-auto w-full pb-10"
      >
        <Link href="/test" prefetch={true}>
          <button
            type="button"
            className="w-full py-[18px] px-6 bg-accent text-white rounded-xl font-semibold text-[17px] tracking-[-0.01em] active:scale-[0.97] transition-all duration-150 select-none"
            style={{ boxShadow: '0 6px 24px color-mix(in srgb, var(--accent) 38%, transparent)' }}
          >
            Пройти тест
          </button>
        </Link>
      </motion.div>
    </main>
  )
}
