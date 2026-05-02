'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { QUESTIONS } from '@/lib/questions'
import type { Answer } from '@/lib/scoring'
import { TEXTS } from '@/lib/constants/texts'

export default function TestPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questionOrder, setQuestionOrder] = useState<number[] | null>(null)
  const [answersMap, setAnswersMap] = useState<Record<number, number>>({})
  const router = useRouter()
  const [tgId, setTgId] = useState<number | null>(null)

  // 1. Get tgId from WebApp and clear old results
  useEffect(() => {
    const WebApp = (window as any).Telegram?.WebApp
    const id = WebApp?.initDataUnsafe?.user?.id
    if (id) {
      setTgId(id)
    } else {
      setTgId(999999999)
    }

    // Clear cached results from previous runs
    sessionStorage.removeItem('eva_result')
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
      let actualToken = stored

      if (!actualToken) {
        try {
          const initData = (window as any).Telegram?.WebApp?.initData
          const authRes = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          })
          const authJson = await authRes.json()
          if (authJson.success && authJson.data?.token) {
            actualToken = authJson.data.token
          } else {
            throw new Error()
          }
        } catch (e) {
          throw new Error('Не удалось получить токен авторизации')
        }
      }

      let finalAnswers = answers
      if (finalAnswers.length < 25) {
        try {
          const progRes = await fetch(`/api/test/progress?tgId=${tgId}`, {
            headers: { Authorization: `Bearer ${actualToken}` },
          })
          const progJson = await progRes.json()
          if (progJson.success && progJson.data?.answers) {
            const dbAnswers: Record<number, number> = progJson.data.answers
            const mergedMap = { ...dbAnswers }
            answers.forEach((a) => {
              mergedMap[a.questionId] = a.score
            })
            finalAnswers = Object.entries(mergedMap).map(([qId, s]) => ({
              questionId: Number(qId),
              score: s as number,
            }))
          }
          if (finalAnswers.length < 25) {
            throw new Error('Не удалось восстановить данные сессии')
          }
        } catch (e) {
          console.error('[test] JIT Fallback failed:', e)
          throw e instanceof Error ? e : new Error('Ошибка восстановления прогресса')
        }
      }

      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${actualToken}`,
        },
        body: JSON.stringify({ answers: finalAnswers, tgId }),
      })
      const result = await res.json()
      console.log('[test] Submit response:', result)

      const elapsed = Date.now() - startTime
      const wait = Math.max(0, 2000 - elapsed)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))

      if (result.success && result.data) {
        console.log('[test] Saving result to sessionStorage:', result.data)
        sessionStorage.setItem('eva_result', JSON.stringify(result.data))
        router.push('/result')
      } else {
        console.error('[test] Submit failed:', result)
        alert('Ошибка при сохранении теста. Пожалуйста, попробуйте еще раз. ' + (result.error || ''))
        setSubmitting(false)
      }
    } catch (err) {
      console.error('Submit error:', err)
      const errorMsg = err instanceof Error && err.message === 'Не удалось получить токен авторизации'
        ? err.message
        : 'Ошибка сети или сервера при сохранении теста.'
      alert(errorMsg)
      setSubmitting(false)
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
        // DEFENSIVE: Only map entries where qId is a valid question ID from our list
        const answers: Answer[] = Object.entries(newMap)
          .filter(([qId]) => QUESTIONS.some(q => q.id === Number(qId)))
          .map(([qId, s]) => ({ questionId: Number(qId), score: s as number }))
        
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
      <div className="min-h-screen bg-[#0f141a] flex items-center justify-center">
        <motion.div
          className="w-10 h-10 border-2 border-[#b0ceb2] border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  const progress = ((currentIndex + 1) / QUESTIONS.length) * 100

  return (
    <div className="font-body-md antialiased overflow-hidden min-h-[100dvh] flex flex-col bg-[#0f141a] text-[#dee2ec]">
      {/* Top Navigation */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 shadow-[0_4px_20px_rgba(0,0,0,0.15)] sticky z-50 top-0 flex justify-between items-center px-5 h-16 w-full shrink-0">
        <button 
          onClick={handleBack}
          className="text-[#8BA88E] active:scale-95 duration-200 flex items-center justify-center font-bold text-sm"
        >
          Назад
        </button>
        <h1 className="font-['Newsreader'] italic text-xl text-[#8BA88E]">EvaTest</h1>
        <div className="font-label-md text-slate-400 tracking-widest uppercase text-[12px]">
          {currentIndex + 1}/{QUESTIONS.length}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-[2px] bg-[#30353d] shrink-0">
        <motion.div 
          className="h-full bg-[#8ba88e] shadow-[0_0_8px_rgba(139,168,142,0.5)]" 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Main Content Canvas */}
      <main className="relative flex-1 flex flex-col px-container-padding py-xl justify-between overflow-hidden">
        {/* Background Aesthetic Element */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-64 h-64 bg-[#b0ceb2]/5 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-[#e2bebe]/5 rounded-full blur-[100px]"></div>
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
              className="font-headline-lg text-[#dee2ec] leading-tight px-sm max-w-md text-[32px] font-medium"
              style={{ fontFamily: 'Newsreader' }}
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
                selected === 'yes' ? 'bg-[#b0ceb2] text-[#1c3622]' : 'bg-[#8ba88e] text-[#233d29]'
              }`}
            >
              <span className="relative z-10 text-lg font-bold">{TEXTS.test.btnYes}</span>
            </button>
            {/* No Button */}
            <button 
              onClick={() => handleAnswer('no')}
              disabled={selected !== null || submitting}
              className={`bg-[rgba(27,32,39,0.6)] backdrop-blur-[12px] text-[#dee2ec] rounded-xl font-label-md flex flex-col items-center justify-center transition-all active:scale-[0.97] border border-[rgba(140,146,139,0.1)] group ${
                selected === 'no' ? 'bg-[#30353d]' : ''
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f141a]/90 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4 text-center px-10">
              <motion.div
                className="w-12 h-12 border-2 border-[#b0ceb2] border-t-transparent rounded-full mb-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <p className="font-['Newsreader'] italic text-2xl text-[#dee2ec]">{TEXTS.test.overlay1}</p>
              <p className="font-body-sm text-[#c2c8c0]">{TEXTS.test.overlay2}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
