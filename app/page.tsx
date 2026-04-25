'use client'

import { useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { openAuthorContact } from '@/lib/author-contact'
import { QUESTIONS } from '@/lib/questions'
import { useGatekeeper } from '@/components/Gatekeeper'

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut', delay },
})

export default function Home() {
  const gatekeeperState = useGatekeeper()
  const cooldownDays = 'cooldownDays' in gatekeeperState ? (gatekeeperState.cooldownDays ?? 0) : 0

  const handleContactAuthor = useCallback(async () => {
    const WebApp = (window as any).Telegram?.WebApp
    const tgId = WebApp?.initDataUnsafe?.user?.id

    if (tgId) {
      try {
        await fetch('/api/user/contact-author', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tgId })
        })
      } catch (err) {
        console.error('[contact-author] API call failed:', err)
      }
    }

    // Открыть чат с автором
    openAuthorContact()
  }, [])

  return (
    <main className="flex h-screen flex-col bg-bg-primary overflow-hidden">
      <div className="flex flex-col flex-1 px-6 pt-8 pb-6 justify-between overflow-y-auto">
        <div className="flex flex-col gap-4">
          <motion.div {...fadeUp(0.22)} className="flex flex-col gap-2">
            {cooldownDays > 0 ? (
              <>
                <h1 className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary">
                  Сейчас нет смысла проходить тест повторно
                </h1>
                <p className="text-[14px] leading-[1.5] text-text-secondary opacity-90">
                  У тебя есть 2 месяца, чтобы демонтировать текущую опору. Через 2 месяца ты сможешь увидеть изменения.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary select-none">
                  У каждого человека есть внутренняя <span className="text-accent">«опора»</span>
                </h1>
                <p className="text-[14px] leading-[1.5] text-text-secondary opacity-90">
                  — способ держать себя в жизни. Часто эта опора искажается. Снаружи это выглядит как характер или привычки, а на деле — устойчивый механизм, который:
                </p>
                <p className="text-[14px] leading-[1.6] text-text-secondary opacity-90">
                  — повторяет одни и те же сценарии{'\n'}
                  — создаёт одни и те же проблемы{'\n'}
                  — не даёт выйти из замкнутого круга
                </p>
                <p className="text-[14px] leading-[1.5] text-text-primary font-medium opacity-90">
                  Сейчас ты увидишь, какая опора у тебя доминирует.
                </p>
              </>
            )}
          </motion.div>

          <motion.div {...fadeUp(0.38)} className="flex gap-2">
            <span className="text-[12px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3 py-1.5 leading-none">
              {QUESTIONS.length} вопросов
            </span>
            <span className="text-[12px] font-medium text-text-muted bg-bg-secondary border border-border rounded-full px-3 py-1.5 leading-none">
              ~5 минут
            </span>
          </motion.div>
        </div>

        <motion.div {...fadeUp(0.52)} className="w-full mt-auto">
          {/* ИСПРАВЛЕНИЕ: Теперь Vercel не ругается, так как переменная 100% число */}
          {cooldownDays > 0 ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled
                className="w-full py-3 px-4 bg-bg-tertiary text-text-muted rounded-xl font-semibold text-[13px] select-none cursor-not-allowed border border-border"
              >
                Повторно пройти тест и узнать, какая у тебя опора можно будет через {cooldownDays} {cooldownDays === 1 ? 'день' : cooldownDays < 5 ? 'дня' : 'дней'}
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleContactAuthor}
                className="w-full py-3 px-4 rounded-xl font-semibold text-[14px] text-white shadow-md active:scale-[0.98] transition-all"
                style={{ background: '#2563eb' }}
              >
                Связаться с Евой
              </motion.button>
            </div>
          ) : (
            <Link href="/test" prefetch={true} className="block w-full">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl font-semibold text-[16px] active:scale-[0.98] transition-all duration-200 select-none shadow-lg text-white"
                style={{ background: '#2563eb' }}
              >
                Пройти тест
              </button>
            </Link>
          )}
        </motion.div>
      </div>
    </main>
  )
}
