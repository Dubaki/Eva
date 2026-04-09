'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { QUESTIONS, type Scale } from '@/lib/questions'
import type { Answer } from '@/lib/scoring'

const SCALE_COLOR: Record<Scale, string> = {
  performance: 'var(--scale-s)',
  perfection: 'var(--scale-u)',
  pleasing: 'var(--scale-p)',
  control: 'var(--scale-r)',
  'hyper-vigilance': 'var(--scale-k)',
}

const FILL_PCT = [3, 8, 16, 28, 100] as const
const BORDER_PCT = [20, 38, 58, 78, 100] as const

function ProgressBar({
  current,
  total,
  color,
  canGoBack,
  onBack,
}: {
  current: number
  total: number
  color: string
  canGoBack: boolean
  onBack: () => void
}) {
  const progress = ((current + 1) / total) * 100
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {canGoBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 bg-white/10 p-2 rounded-lg text-[14px] font-medium text-text-primary hover:bg-white/20 transition-colors select-none"
            aria-label="Previous question"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Назад
          </button>
        ) : (
          <span className="w-16" />
        )}
        <span className="text-[13px] font-medium text-text-muted tabular-nums">
          {current + 1}/{total}
        </span>
      </div>
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: progress + '%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function answerStyle(
  value: number,
  isSelected: boolean,
  accentColor: string,
): React.CSSProperties {
  if (isSelected) {
    return {
      background: accentColor,
      border: '1.5px solid ' + accentColor,
      color: '#ffffff',
      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
    }
  }
  const i = value - 1
  const isMax = value === 5
  return {
    background: 'color-mix(in srgb, ' + accentColor + ' ' + FILL_PCT[i] + '%, var(--bg-secondary))',
    border: '1.5px solid color-mix(in srgb, ' + accentColor + ' ' + BORDER_PCT[i] + '%, var(--border))',
    color: isMax
      ? '#ffffff'
      : 'color-mix(in srgb, ' + accentColor + ' ' + (40 + i * 15) + '%, var(--text-secondary))',
  }
}

export default function TestPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [answersMap, setAnswersMap] = useState<Record<number, number>>({})
  const router = useRouter()

  const question = QUESTIONS[currentIndex]
  const accentColor = SCALE_COLOR[question.scale]
  const canGoBack = currentIndex > 0
  const currentAnswer = answersMap[question.id] ?? null

  const submitAnswers = useCallback(async (answers: Answer[]) => {
    try {
      const stored = localStorage.getItem('eva_token')
      const token = stored || ''
      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ answers }),
      })
      const result = await res.json()
      if (!result.success) {
        console.error('Submit failed:', result.error)
        router.push('/result')
        return
      }
      sessionStorage.setItem('eva_result', JSON.stringify(result.data))
      router.push('/result')
    } catch (err) {
      console.error('Submit error:', err)
      router.push('/result')
    }
  }, [router])

  const handleAnswer = useCallback(
    (value: number) => {
      if (selected !== null) return
      setSelected(value)
      setAnswersMap((prev) => ({ ...prev, [question.id]: value }))
      setTimeout(() => {
        setSelected(null)
        if (currentIndex >= QUESTIONS.length - 1) {
          setSubmitting(true)
          const answers: Answer[] = Object.entries(answersMap).map(
            ([qId, score]) => ({ questionId: Number(qId), score })
          )
          answers.push({ questionId: question.id, score: value })
          submitAnswers(answers)
        } else {
          setCurrentIndex((i) => i + 1)
        }
      }, 200)
    },
    [selected, currentIndex, question.id, answersMap, submitAnswers],
  )

  const handleBack = useCallback(() => {
    if (!canGoBack) return
    setCurrentIndex((i) => i - 1)
    setSelected(null)
  }, [canGoBack])

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary overflow-hidden">
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/95 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4">
              <motion.div
                className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <p className="text-text-secondary text-sm">Анализируем ответы…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-1 px-5 pt-6 pb-8 gap-5 max-w-sm mx-auto w-full">
        <ProgressBar
          current={currentIndex}
          total={QUESTIONS.length}
          color={accentColor}
          canGoBack={canGoBack}
          onBack={handleBack}
        />

        {/* Question — centered in remaining space */}
        <div className="flex flex-col flex-1 justify-center gap-4">
          <AnimatePresence mode="wait">
            <motion.p
              key={question.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="text-[17px] font-medium leading-[1.55] tracking-[-0.01em] text-text-primary text-center"
            >
              {question.text}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-stretch gap-2">
            {([1, 2, 3, 4, 5] as const).map((value) => (
              <motion.button
                key={value}
                type="button"
                whileTap={{ scale: 0.91 }}
                transition={{ duration: 0.1 }}
                onClick={() => handleAnswer(value)}
                className="flex-1 aspect-square rounded-xl flex items-center justify-center text-[15px] font-semibold select-none focus:outline-none"
                style={answerStyle(value, selected === value || currentAnswer === value, accentColor)}
              >
                {value}
              </motion.button>
            ))}
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] text-text-muted leading-none">
              Совсем не про меня
            </span>
            <span className="text-[11px] text-text-muted leading-none">
              Это точно я
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
