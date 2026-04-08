'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

/**
 * Страница-заглушка с WOW-анимацией «анализа» перед показом результата.
 * Показывает 2-3 секунды анимированную визуализацию обработки данных,
 * затем автоматически переходит на /result.
 */
export default function LoadingPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/result')
    }, 2500)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-6">
        {/* Анимированный круг — «нейросеть анализирует» */}
        <div className="relative w-24 h-24">
          {/* Внешнее кольцо */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-accent/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
          {/* Среднее кольцо */}
          <motion.div
            className="absolute inset-3 rounded-full border-2 border-accent/50"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          {/* Внутреннее кольцо */}
          <motion.div
            className="absolute inset-6 rounded-full border-2 border-accent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          {/* Центральная точка */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-3 h-3 rounded-full bg-accent" />
          </motion.div>
        </div>

        {/* Текст */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-text-primary text-lg font-medium">
            Анализируем ваши ответы…
          </p>
          <p className="text-text-secondary text-sm mt-1">
            Это займёт пару секунд
          </p>
        </motion.div>
      </div>
    </main>
  )
}
