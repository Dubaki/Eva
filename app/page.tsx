'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut', delay },
})

export default function Home() {
  const router = useRouter()
  const [starting, setStarting] = useState(false)

  const handleStart = useCallback(async () => {
    if (starting) return // защита от двойного клика
    setStarting(true)

    try {
      // В будущем здесь может быть проверка авторизации
      // или инициализация сессии через /api/auth.
      // Если API недоступен — всё равно переходим на /test
      // (Graceful Degradation: пользователь не должен застревать).
      router.push('/test')
    } catch (error) {
      // Критично для отладки внутри Telegram — показываем ошибку
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
      alert('Ошибка старта: ' + message)

      // Fallback: всё равно переходим, чтобы пользователь не застрял
      router.push('/test')
    } finally {
      setStarting(false)
    }
  }, [starting, router])

  return (
    <main className="flex min-h-screen flex-col bg-bg-primary px-5">
      <div className="flex-1" />

      <div className="flex flex-col gap-7 max-w-sm mx-auto w-full">

        {/* Brand glyph */}
        <motion.div {...fadeUp(0.1)}>
          <div className="w-12 h-12 rounded-2xl bg-accent-light flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="4" fill="var(--accent)" />
              <circle cx="11" cy="11" r="8.5" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.3" />
            </svg>
          </div>
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
        <button
          type="button"
          disabled={starting}
          onClick={handleStart}
          className="w-full py-[18px] px-6 bg-accent text-white rounded-xl font-semibold text-[17px] tracking-[-0.01em] active:scale-[0.97] transition-all duration-150 select-none disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ boxShadow: starting ? 'none' : '0 6px 24px color-mix(in srgb, var(--accent) 38%, transparent)' }}
        >
          {starting ? 'Загрузка…' : 'Посмотреть'}
        </button>
      </motion.div>
    </main>
  )
}
