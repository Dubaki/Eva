'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import EvaHeader from '@/components/EvaHeader'
import { TEXTS, RESULT_TEXTS } from '@/lib/constants/texts'

type ResultData = {
  dominantTrait: string
  secondaryTrait: string
}

type FunnelStep = 'result' | 'insight'

const fadeUp = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
})

const RESULT_IMG: Record<string, string> = {
  S: '/hero.png',
  U: '/pleaser.png',
  P: '/perfectionist.png',
  R: '/stayer.png',
  K: '/controller.png',
}

function ResultLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </main>
  )
}

function ResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<FunnelStep>('result')
  const [surpriseAnswer, setSurpriseAnswer] = useState<'yes' | 'no' | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('eva_result')
    if (stored) {
      try {
        setResult(JSON.parse(stored))
        setLoading(false)
      } catch (e) {
        console.error('Failed to parse stored result', e)
      }
    }

    const token = localStorage.getItem('eva_token')
    fetch('/api/test/results', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(json => {
      if (json.success && json.data) {
        setResult(json.data)
        sessionStorage.setItem('eva_result', JSON.stringify(json.data))
      }
      setLoading(false)
    })
    .catch(() => setLoading(false))

    // Если пришли за рефералкой напрямую
    if (searchParams.get('referral') === '1') {
      router.replace('/access')
    }
  }, [searchParams, router])

  const handleSurprise = (val: 'yes' | 'no') => {
    setSurpriseAnswer(val)
    setStep('insight')
  }

  if (loading) return <ResultLoading />

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-container-padding text-center">
        <h1 className="text-xl font-bold mb-4">Результат не найден</h1>
        <button onClick={() => router.push('/')} className="bg-primary text-on-primary px-6 py-2 rounded-full">На главную</button>
      </div>
    )
  }

  const trait = result.dominantTrait.toUpperCase()
  const traitName = TEXTS.result.traitNames[trait] || trait
  const traitImg = RESULT_IMG[trait] || '/hero.png'
  const traitFullText = RESULT_TEXTS[trait] || ''

  return (
    <div className="font-body-md bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 pb-32 pt-16">
        <section className="relative w-full h-[397px] overflow-hidden">
          <motion.img 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            src={traitImg} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-container-padding">
            <span className="inline-block px-3 py-1 bg-primary/20 text-primary rounded-full text-label-sm mb-sm backdrop-blur-sm border border-primary/20">
              {TEXTS.result.badge}
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface leading-tight">
              {TEXTS.result.titleTemplate}{traitName}
            </h2>
          </div>
        </section>

        <div className="px-container-padding space-y-xl mt-md">
          <motion.article {...fadeUp()} className="glass-card p-lg rounded-xl">
            <div className="font-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: traitFullText }} />
          </motion.article>

          <AnimatePresence mode="wait">
            {step === 'result' && (
              <motion.section key="result-step" {...fadeUp()} className="space-y-md">
                <h3 className="font-headline-md text-headline-md text-center">{TEXTS.result.questionTitle}</h3>
                <div className="flex gap-md">
                  <button 
                    onClick={() => handleSurprise('yes')}
                    className="flex-1 py-md bg-primary text-on-primary font-label-md rounded-xl active:scale-95 transition-transform"
                  >
                    {TEXTS.result.btnYes}
                  </button>
                  <button 
                    onClick={() => handleSurprise('no')}
                    className="flex-1 py-md border border-secondary text-secondary font-label-md rounded-xl active:scale-95 transition-transform"
                  >
                    {TEXTS.result.btnNo}
                  </button>
                </div>
              </motion.section>
            )}

            {step === 'insight' && (
              <motion.section key="insight-step" {...fadeUp()} className="space-y-lg">
                <div className="relative pl-lg py-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"></div>
                  <p className="font-body-sm text-on-surface-variant italic leading-relaxed">
                    {surpriseAnswer === 'yes' ? TEXTS.result.insightYes1 : TEXTS.result.insightNo1}
                    <br /><br />
                    {surpriseAnswer === 'yes' ? TEXTS.result.insightYes2 : TEXTS.result.insightNo2}
                  </p>
                </div>
                
                <div className="p-lg rounded-xl border border-outline-variant bg-surface-container-low space-y-md">
                  <h3 className="font-body-lg text-center text-on-surface">{TEXTS.result.secondQuestion}</h3>
                  <div className="flex flex-col gap-sm">
                    <button 
                      onClick={() => router.push('/access')}
                      className="w-full py-md bg-primary text-on-primary font-label-md rounded-xl active:scale-95 transition-transform shadow-lg shadow-primary/10"
                    >
                      {TEXTS.result.btnSecondYes}
                    </button>
                    <button 
                      onClick={() => router.push('/mechanism')}
                      className="w-full py-md text-outline font-label-md rounded-xl active:scale-95 transition-transform"
                    >
                      {TEXTS.result.btnSecondNo}
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={<ResultLoading />}>
      <ResultContent />
    </Suspense>
  )
}
