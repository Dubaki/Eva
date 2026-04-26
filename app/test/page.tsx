'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { QUESTIONS } from '@/lib/questions'
import type { Answer } from '@/lib/scoring'
import EvaHeader from '@/components/EvaHeader'
import { TEXTS } from '@/lib/constants/texts'

/** Progress Bar Component */
function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = ((current) / total) * 100
  return (
    <div className="w-full h-[2px] bg-surface-container-highest shrink-0">
      <motion.div
        className="h-full bg-primary-container shadow-[0_0_8px_rgba(139,168,142,0.5)]"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}

export default function TestPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questionOrder, setQuestionOrder] = useState<number[] | null>(null)
  const [answersMap, setAnswersMap] = useState<Record<number, number>>({})
  const router = useRouter()
  const [tgId, setTgId] = useState<number | null>(null)

  // 1. Get tgId from WebApp
  useEffect(() => {
    const WebApp = (window as any).Telegram?.WebApp
    const id = WebApp?.initDataUnsafe?.user?.id
    if (id) {
      setTgId(id)
    } else {
      // For development/testing
      setTgId(999999999)
    }
  }, [])

  // 2. Restore progress
  useEffect(() => {
    if (!tgId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/test/progress?tgId=${tgId}`)
        const json = await res.json()
        if (!cancelled && json.success && json.data) {
          if (json.data.isCooldown) {
            router.push('/')
            return
          }
          const { currentStep, answers, question_order } = json.data
          if (currentStep > 0 && currentStep < QUESTIONS.length) {
            setCurrentIndex(currentStep)
            if (answers) setAnswersMap(answers)
          }
          if (question_order) setQuestionOrder(question_order)
        }
      } catch (e) {
        console.error('[test] Failed to load progress:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tgId, router])

  // 3. Save progress
  const saveStep = useCallback(async (step: number) => {
    if (!tgId) return
    try {
      await fetch('/api/test/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, tgId }),
        keepalive: true,
      })
    } catch (e) {
      console.error('[test] Failed to save progress:', e)
    }
  }, [tgId])

  useEffect(() => {
    if (loading || submitting) return
    saveStep(currentIndex)
  }, [currentIndex, loading, submitting, saveStep])

  const actualQuestionIndex = questionOrder?.[currentIndex] ?? currentIndex
  const question = QUESTIONS[actualQuestionIndex]

  const submitAnswers = useCallback(async (answers: Answer[]) => {
    setSubmitting(true)
    const startTime = Date.now()
    try {
      const stored = localStorage.getItem('eva_token')
      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (stored || ''),
        },
        body: JSON.stringify({ answers, tgId }),
      })
      const result = await res.json()

      const elapsed = Date.now() - startTime
      const wait = Math.max(0, 2000 - elapsed)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))

      if (result.success) {
        sessionStorage.setItem('eva_result', JSON.stringify(result.data))
        router.push('/result')
      } else {
        router.push('/result')
      }
    } catch (err) {
      console.error('Submit error:', err)
      router.push('/result')
    }
  }, [router, tgId])

  const handleAnswer = useCallback((value: 'yes' | 'no') => {
    if (selected !== null || submitting) return
    setSelected(value)
    const score = value === 'yes' ? 1 : 0
    const newMap = { ...answersMap, [question.id]: score }
    setAnswersMap(newMap)

    setTimeout(() => {
      if (currentIndex >= QUESTIONS.length - 1) {
        const answers: Answer[] = Object.entries(newMap).map(
          ([qId, s]) => ({ questionId: Number(qId), score: s as number })
        )
        submitAnswers(answers)
      } else {
        setSelected(null)
        setCurrentIndex(i => i + 1)
      }
    }, 250)
  }, [selected, submitting, currentIndex, question.id, answersMap, submitAnswers])

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setSelected(null)
    } else {
      router.push('/')
    }
  }, [currentIndex, router])

  if (loading || !question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  return (
    <div className="font-body-md antialiased overflow-hidden min-h-[100dvh] flex flex-col bg-background">
      {/* Header Replacement Spacer or System Space */}
      <div className="h-16 shrink-0" />

      {/* Progress Bar */}
      <ProgressBar current={currentIndex + 1} total={QUESTIONS.length} />

      {/* Main Content Canvas */}
      <main className="relative flex-1 flex flex-col px-container-padding py-xl justify-between overflow-hidden">
        {/* Background Aesthetic Element */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-secondary/5 rounded-full blur-[100px]"></div>
        </div>

        {/* Question Area */}
        <section className="flex-1 flex flex-col justify-center items-center text-center space-y-lg">
          <AnimatePresence mode="wait">
            <motion.h2
              key={question.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="font-headline-lg text-headline-lg text-on-surface leading-tight px-sm max-w-md"
            >
              {question.text}
            </motion.h2>
          </AnimatePresence>
        </section>

        {/* Response Actions */}
        <section className="pb-xl space-y-md shrink-0">
          <div className="grid grid-cols-2 gap-md h-24">
            {/* Yes Button */}
            <button 
              onClick={() => handleAnswer('yes')}
              disabled={selected !== null || submitting}
              className={`rounded-xl font-label-md flex flex-col items-center justify-center transition-all active:scale-[0.97] shadow-lg shadow-black/20 group relative overflow-hidden ${
                selected === 'yes' ? 'bg-primary text-on-primary' : 'bg-primary-container text-on-primary-container'
              }`}
            >
              <span className="relative z-10 text-lg font-bold">{TEXTS.test.btnYes}</span>
            </button>
            {/* No Button */}
            <button 
              onClick={() => handleAnswer('no')}
              disabled={selected !== null || submitting}
              className={`glass-card text-on-surface rounded-xl font-label-md flex flex-col items-center justify-center transition-all active:scale-[0.97] border border-outline/20 group ${
                selected === 'no' ? 'bg-surface-variant' : ''
              }`}
            >
              <span className="text-lg font-bold">{TEXTS.test.btnNo}</span>
            </button>
          </div>
        </section>
      </main>

      {/* Submitting Overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4 text-center px-10">
              <motion.div
                className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full mb-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <p className="font-headline-md italic text-on-surface">{TEXTS.test.overlay1}</p>
              <p className="font-body-sm text-on-surface-variant">{TEXTS.test.overlay2}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
