'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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

/** Debounce helper: saves step to DB only after the user stops navigating for a short delay */
function useStepSave(tgId: number | null) {
  const saveStep = useCallback(
    async (step: number) => {
      if (!tgId) return
      try {
        await fetch('/api/test/progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step, tgId }),
          keepalive: true, // Гарантирует отправку даже при закрытии приложения
        })
      } catch (e) {
        console.error('[test] Failed to save progress:', e)
      }
    },
    [tgId],
  )

  return saveStep
}

export default function TestPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questionOrder, setQuestionOrder] = useState<number[] | null>(null)
  const [answersMap, setAnswersMap] = useState<Record<number, number>>({})
  const [cooldownEnd, setCooldownEnd] = useState<string | null>(null)
  const router = useRouter()

  // Extract tgId from Telegram WebApp
  const [tgId, setTgId] = useState<number | null>(null)

  useEffect(() => {
    const WebApp = typeof window !== 'undefined'
      ? (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp
      : null
    const id = WebApp?.initDataUnsafe?.user?.id ?? null
    if (id) {
      setTgId(id)
    } else {
      console.warn('[test] No tgId available from Telegram SDK')
      // Small delay to allow SDK to initialize
      const timer = setTimeout(() => {
        const retryId = WebApp?.initDataUnsafe?.user?.id ?? null
        if (retryId) setTgId(retryId)
        else setLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveStep = useStepSave(tgId)

  // Restore saved progress on mount (or when tgId becomes available)
  useEffect(() => {
    if (!tgId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/test/progress?tgId=${tgId}`)
        const json = await res.json()
        if (!cancelled && json.success && json.data) {
          if (json.data.isCooldown) {
            setCooldownEnd(json.data.availableAt)
            setLoading(false)
            return
          }

          const { currentStep, answers, question_order } = json.data as { 
            currentStep: number; 
            answers: Record<number, number> | null;
            question_order: number[] | null;
          }
          if (currentStep > 0 && currentStep < QUESTIONS.length) {
            setCurrentIndex(currentStep)
            if (answers) {
              setAnswersMap(answers)
            }
          }
          if (question_order) {
            setQuestionOrder(question_order)
          }
        }
      } catch (e) {
        console.error('[test] Failed to load progress:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tgId])

  // Save step when currentIndex changes (after loading is done)
  useEffect(() => {
    if (loading || submitting) return
    saveStep(currentIndex)
  }, [currentIndex, loading, submitting, saveStep])

  const actualQuestionIndex = questionOrder?.[currentIndex] ?? currentIndex
  const question = QUESTIONS[actualQuestionIndex]
  const accentColor = SCALE_COLOR[question.scale]
  const canGoBack = currentIndex > 0
  const currentAnswer = answersMap[question.id] ?? null

  const submitAnswers = useCallback(async (answers: Answer[]) => {
    // ── Protection against broken state ──
    if (answers.length !== QUESTIONS.length) {
      console.error('[test/submit] State mismatch detected:', answers.length, 'vs', QUESTIONS.length)
      setAnswersMap({})
      setCurrentIndex(0)
      setSubmitting(false)
      alert('Данные рассинхронизированы. Тест запущен заново для корректного сохранения.')
      return
    }

    const startTime = Date.now()
    try {
      console.log('=== ТЕСТ ЗАВЕРШЕН (client) ===')
      const stored = localStorage.getItem('eva_token')
      const token = stored || ''

      console.log('[test/submit] Using tgId from state:', tgId)

      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ answers, tgId }),
      })
      const result = await res.json()
      console.log('Server response:', result)

      // Ensure minimum 2.5s delay for UX
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2500 - elapsed)
      if (remaining > 0) {
        console.log(`[test] Waiting ${remaining}ms for minimum delay`)
        await new Promise((r) => setTimeout(r, remaining))
      }

      if (!result.success) {
        console.error('[test/submit] Submit failed:', result.error)
        // Show RPC error to the user (for debugging)
        if (result.error && result.error !== 'cooldown') {
          alert(`⚠️ Ошибка сохранения: ${result.error}`)
        }
        // Even on failure, go to result — user sees the computed result from sessionStorage fallback
        router.push('/result')
        return
      }
      console.log('Saving result to sessionStorage:', result.data)
      // sessionStorage — только для мгновенной отрисовки сразу после прохождения теста. Источник истины — API.
      sessionStorage.setItem('eva_result', JSON.stringify(result.data))
      router.push('/result')    } catch (err) {
      console.error('Submit error:', err)
      router.push('/result')
    }
  }, [router, tgId])

  const handleAnswer = useCallback(
    (value: 'yes' | 'no') => {
      if (selected !== null || submitting) return
      setSelected(value)
      const score = value === 'yes' ? 1 : 0
      
      // 1. Сначала считаем актуальный словарь
      const newMap = { ...answersMap, [question.id]: score }
      
      // 2. Обновляем состояние
      setAnswersMap(newMap)
      
      setTimeout(() => {
        if (currentIndex >= QUESTIONS.length - 1) {
          // 3. Строим массив ответов из Object.entries(newMap) без .push
          const answers: Answer[] = Object.entries(newMap).map(
            ([qId, s]) => ({ questionId: Number(qId), score: s as number })
          )

          // 4. Валидация полноты ответов
          if (answers.length !== QUESTIONS.length) {
            console.error('[test] Incomplete answers detected:', answers.length)
            // Ищем первый пропущенный вопрос
            const firstMissingIndex = QUESTIONS.findIndex(q => newMap[q.id] === undefined)
            if (firstMissingIndex !== -1) {
              setCurrentIndex(firstMissingIndex)
              setSelected(null)
              return
            }
          }

          setSubmitting(true)
          submitAnswers(answers)
        } else {
          setSelected(null)
          setCurrentIndex((i) => i + 1)
        }
      }, 200)
    },
    [selected, submitting, currentIndex, question.id, answersMap, submitAnswers],
  )

  const handleBack = useCallback(() => {
    if (!canGoBack) return
    setCurrentIndex((i) => i - 1)
    setSelected(null)
  }, [canGoBack])

  // Show loading while restoring progress
  if (loading) {
    return (
      <main className="flex flex-col min-h-screen bg-bg-primary overflow-hidden items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-text-secondary text-sm">Загружаю прогресс...</p>
        </div>
      </main>
    )
  }

  // Cooldown screen
  if (cooldownEnd) {
    const date = new Date(cooldownEnd).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    return (
      <main className="flex flex-col min-h-screen bg-bg-primary items-center justify-center px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-bg-tertiary rounded-2xl flex items-center justify-center text-3xl">
            ⏳
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-xl font-bold text-text-primary">
              Тест пока недоступен
            </h1>
            <p className="text-text-secondary leading-relaxed">
              Повторное прохождение теста будет доступно через 60 дней после предыдущего.
            </p>
            <div className="bg-bg-tertiary/50 p-4 rounded-xl mt-2 border border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">
                Следующая попытка
              </p>
              <p className="text-lg font-bold text-accent">
                {date}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full py-4 bg-bg-secondary border border-border rounded-xl font-semibold text-text-primary mt-4"
          >
            На главную
          </button>
        </div>
      </main>
    )
  }

  // Initializing order screen
  if (!questionOrder && tgId) {
    return (
      <main className="flex flex-col min-h-screen bg-bg-primary overflow-hidden items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-text-secondary text-sm">Инициализирую порядок вопросов...</p>
        </div>
      </main>
    )
  }

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
              <p className="text-text-secondary text-sm">Сейчас посчитаю.</p>
              <p className="text-text-muted text-xs mt-1">Это не совсем то, что ты думаешь.</p>
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

        {/* Yes / No buttons */}
        <div className="flex gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
            onClick={() => handleAnswer('yes')}
            className="flex-1 py-4 rounded-xl font-semibold text-[16px] text-white select-none focus:outline-none"
            style={{
              background:
                selected === 'yes' || currentAnswer === 1
                  ? accentColor
                  : 'color-mix(in srgb, ' + accentColor + ' 20%, var(--bg-secondary))',
              border: `1.5px solid ${selected === 'yes' || currentAnswer === 1 ? accentColor : 'var(--border)'}`,
            }}
          >
            Да
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
            onClick={() => handleAnswer('no')}
            className="flex-1 py-4 rounded-xl font-semibold text-[16px] text-text-primary select-none focus:outline-none"
            style={{
              background: 'var(--bg-secondary)',
              border: `1.5px solid ${selected === 'no' || currentAnswer === 0 ? accentColor : 'var(--border)'}`,
            }}
          >
            Нет
          </motion.button>
        </div>
      </div>
    </main>
  )
}
