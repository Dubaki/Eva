'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { QUESTIONS, type Scale } from '@/lib/questions'
import type { Answer } from '@/lib/scoring'

const HERO_SRC: Record<Scale, string> = {
  performance:      '/hero.png',
  pleasing:         '/pleaser.png',
  perfection:       '/perfectionist.png',
  'hyper-vigilance':'/stayer.png',
  control:          '/controller.png',
}

const SCALE_COLOR: Record<Scale, string> = {
  performance:      'var(--scale-s)',
  perfection:       'var(--scale-u)',
  pleasing:         'var(--scale-p)',
  control:          'var(--scale-r)',
  'hyper-vigilance':'var(--scale-k)',
}

const FILL_PCT  = [3,  8,  16, 28, 100] as const
const BORDER_PCT = [20, 38, 58, 78, 100] as const

function answerStyle(
  value: number,
  isSelected: boolean,
  accentColor: string,
): React.CSSProperties {
  if (isSelected) {
    return {
      background: accentColor,
      border: `1.5px solid ${accentColor}`,
      color: '#ffffff',
      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
    }
  }
  const i = value - 1
  const isMax = value === 5
  return {
    background: `color-mix(in srgb, ${accentColor} ${FILL_PCT[i]}%, var(--bg-secondary))`,
    border: `1.5px solid color-mix(in srgb, ${accentColor} ${BORDER_PCT[i]}%, var(--border))`,
    // Для кнопки "5" — белый текст на полном фоне акцента, для остальных — смешанный
    color: isMax
      ? '#ffffff'
      : `color-mix(in srgb, ${accentColor} ${40 + i * 15}%, var(--text-secondary))`,
  }
}

export default function TestPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const answersRef = useRef<Answer[]>([])
  const router = useRouter()

  const question  = QUESTIONS[currentIndex]
  const accentColor = SCALE_COLOR[question.scale]
  const progress  = ((currentIndex + 1) / QUESTIONS.length) * 100

  const submitAnswers = useCallback(async (answers: Answer[]) => {
    try {
      const stored = localStorage.getItem('eva_token')
      const token = stored || ''

      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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

      answersRef.current.push({ questionId: question.id, score: value })

      setTimeout(() => {
        setSelected(null)

        if (currentIndex >= QUESTIONS.length - 1) {
          setSubmitting(true)
          submitAnswers(answersRef.current)
        } else {
          setCurrentIndex((i) => i + 1)
        }
      }, 200)
    },
    [selected, currentIndex, question.id, submitAnswers],
  )

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary overflow-hidden">

      {/* ── Loading overlay (submitting) ─────────────────────────────── */}
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

      {/* ── Hero block — вся картинка видна полностью ─────────── */}
      <div className="relative w-full flex-shrink-0 px-3 pt-4 pb-2">
        <AnimatePresence>
          <motion.div
            key={question.scale}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="relative flex items-center justify-center"
            style={{ minHeight: '180px' }}
          >
            {/* Tinted gradient fallback */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: `linear-gradient(180deg,
                  color-mix(in srgb, ${accentColor} 20%, var(--bg-primary)) 0%,
                  var(--bg-primary) 100%)`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_SRC[question.scale]}
              alt=""
              aria-hidden
              className="relative z-10 max-h-[45vh] w-auto rounded-xl"
              style={{
                objectFit: 'contain',
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 px-5 pt-4 pb-8 gap-5 max-w-sm mx-auto w-full">

        {/* Progress bar + counter */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-text-muted tabular-nums">
            {currentIndex + 1}&thinsp;/&thinsp;{QUESTIONS.length}
          </span>
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: accentColor }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Question text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={question.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="text-[17px] font-medium leading-[1.55] tracking-[-0.01em] text-text-primary"
          >
            {question.text}
          </motion.p>
        </AnimatePresence>

        <div className="flex-1" />

        {/* Answer panel */}
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
                style={answerStyle(value, selected === value, accentColor)}
              >
                {value}
              </motion.button>
            ))}
          </div>

          {/* Axis labels */}
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
