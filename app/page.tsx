'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut', delay },
})

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const profileRaw = localStorage.getItem('eva_profile')
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as { tg_id?: number }
        if (TESTER_IDS.includes(String(p.tg_id))) setIsAdmin(true)
      } catch { /* ignore */ }
    }
  }, [])

  return (
    <main className="flex h-screen flex-col bg-bg-primary overflow-hidden">
      <div className="flex flex-col flex-1 px-6 pt-12 pb-10 justify-between">
        <div className="flex flex-col gap-6">
          {/* Heading + body — no image */}
          <motion.div {...fadeUp(0.22)} className="flex flex-col gap-3">
            <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary">
              У каждого человека есть внутренняя <span className="text-accent">«опора»</span>
            </h1>
            <p className="text-[15px] leading-[1.6] text-text-secondary opacity-90">
              — способ держать себя в жизни. Часто эта опора искажается. Снаружи это выглядит как характер или привычки, а на деле — устойчивый механизм, который:
            </p>
            <p className="text-[15px] leading-[1.7] text-text-secondary opacity-90">
              — повторяет одни и те же сценарии{'\n'}
              — создаёт одни и те же проблемы{'\n'}
              — не даёт выйти из замкнутого круга
            </p>
            <p className="text-[15px] leading-[1.6] text-text-primary font-medium opacity-90">
              Сейчас ты увидишь, какая опора у тебя доминирует.
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

        {/* CTA button + Admin link */}
        <motion.div
          {...fadeUp(0.52)}
          className="w-full mt-auto flex flex-col gap-3"
        >
          <Link href="/test" prefetch={true} className="block w-full">
            <button
              type="button"
              className="w-full py-[20px] px-6 bg-accent text-white rounded-2xl font-semibold text-[17px] tracking-[-0.01em] active:scale-[0.98] transition-all duration-200 select-none shadow-lg shadow-accent/25"
            >
              ✨ Пройти тест
            </button>
          </Link>

          {isAdmin && (
            <Link href="/admin" className="block w-full">
              <button
                type="button"
                className="w-full py-2.5 rounded-xl text-[12px] font-medium text-text-muted border border-border hover:text-accent hover:border-accent transition-colors select-none"
              >
                👑 Админ-панель
              </button>
            </Link>
          )}
        </motion.div>
      </div>
    </main>
  )
}
