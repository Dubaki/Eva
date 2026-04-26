'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { TEXTS, RESULT_TEXTS } from '@/lib/constants/texts'

type ResultData = {
  primary_support: string
  secondary_support: string
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
    <main className="flex min-h-screen items-center justify-center bg-[#0f141a]">
      <div className="w-10 h-10 border-2 border-[#8BA88E] border-t-transparent rounded-full animate-spin" />
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
    let hasLocalData = false
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.primary_support) {
          setResult(parsed)
          setLoading(false)
          hasLocalData = true
        }
      } catch (e) {
        console.error('Failed to parse stored result', e)
      }
    }

    const token = localStorage.getItem('eva_token')
    if (!token) {
      if (!hasLocalData) setLoading(false)
      return
    }

    fetch('/api/test/results', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(json => {
      if (json.success && json.data) {
        setResult(json.data)
        sessionStorage.setItem('eva_result', JSON.stringify(json.data))
      }
    })
    .catch(err => console.error('[result] API fetch error:', err))
    .finally(() => {
      setLoading(false)
    })

    if (searchParams.get('referral') === '1') {
      router.replace('/access')
    }
  }, [searchParams, router])

  const handleSurprise = (val: 'yes' | 'no') => {
    setSurpriseAnswer(val)
    setStep('insight')
    
    // Smooth scroll to the new content after a delay to allow animation to complete
    setTimeout(() => {
      const element = document.getElementById('insight-block')
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }

  if (loading) return <ResultLoading />

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0f141a] flex flex-col items-center justify-center p- container-padding text-center text-[#dee2ec]">
        <h1 className="text-xl font-bold mb-4 font-['Newsreader'] italic">Результат не найден</h1>
        <button 
          onClick={() => router.push('/')} 
          className="bg-[#8BA88E] text-[#1c3622] px-6 py-2 rounded-full font-bold active:scale-95 transition-transform"
        >
          На главную
        </button>
      </div>
    )
  }

  const trait = (result.primary_support || 'S').toUpperCase()
  const traitName = TEXTS.result.traitNames[trait] || trait
  const traitImg = RESULT_IMG[trait] || '/hero.png'
  const traitFullText = RESULT_TEXTS[trait] || ''

  return (
    <div className="font-body-md bg-[#0f141a] text-[#dee2ec] min-h-screen flex flex-col">
      <main className="flex-1 pb-32">
        {/* Hero Section */}
        <section className="relative w-full h-[397px] overflow-hidden">
          <motion.img 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            src={traitImg} 
            className="w-full h-full object-cover"
            alt={traitName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f141a] via-[#0f141a]/20 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-container-padding">
            <span className="inline-block px-3 py-1 bg-[#8BA88E]/20 text-[#8BA88E] rounded-full text-label-sm mb-sm backdrop-blur-sm border border-[#8BA88E]/20">
              {TEXTS.result.badge}
            </span>
            <h2 className="font-['Newsreader'] italic text-[32px] text-[#dee2ec] leading-tight">
              {TEXTS.result.titleTemplate}{traitName}
            </h2>
          </div>
        </section>

        <div className="px-container-padding space-y-xl mt-md">
          {/* Main Result Card */}
          <motion.article {...fadeUp(0.1)} className="glass-card p-lg rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div 
              className="font-body-md text-[#dee2ec]/80 leading-relaxed whitespace-pre-wrap" 
              dangerouslySetInnerHTML={{ __html: traitFullText }} 
            />
          </motion.article>

          <AnimatePresence mode="wait">
            {step === 'result' && (
              <motion.section 
                key="result-step" 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-md"
              >
                <h3 className="font-['Newsreader'] italic text-2xl text-center text-[#dee2ec]">{TEXTS.result.questionTitle}</h3>
                <div className="flex gap-md">
                  <button 
                    onClick={() => handleSurprise('yes')}
                    className="flex-1 py-md bg-[#8BA88E] text-[#1c3622] font-bold rounded-xl active:scale-95 transition-transform"
                  >
                    {TEXTS.result.btnYes}
                  </button>
                  <button 
                    onClick={() => handleSurprise('no')}
                    className="flex-1 py-md border border-[#8BA88E]/30 text-[#8BA88E] font-bold rounded-xl active:scale-95 transition-transform"
                  >
                    {TEXTS.result.btnNo}
                  </button>
                </div>
              </motion.section>
            )}

            {step === 'insight' && (
              <motion.section 
                key="insight-step" 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-lg"
                id="insight-block"
              >
                {/* Insight Block with Vertical Line */}
                <div className="relative pl-lg py-sm border-l-2 border-[#8BA88E]">
                  <p className="font-body-sm text-[#dee2ec]/70 italic leading-relaxed">
                    {surpriseAnswer === 'yes' ? TEXTS.result.insightYes1 : TEXTS.result.insightNo1}
                    <br /><br />
                    {surpriseAnswer === 'yes' ? TEXTS.result.insightYes2 : TEXTS.result.insightNo2}
                  </p>
                </div>
                
                {/* Second Support Promo */}
                <div className="p-lg rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md space-y-md">
                  <h3 className="font-body-lg text-center text-[#dee2ec]">{TEXTS.result.secondQuestion}</h3>
                  <div className="flex flex-col gap-sm">
                    <button 
                      onClick={() => router.push('/access')}
                      className="w-full py-md bg-[#8BA88E] text-[#1c3622] font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-[#8BA88E]/10"
                    >
                      {TEXTS.result.btnSecondYes}
                    </button>
                    <button 
                      onClick={() => router.push('/mechanism')}
                      className="w-full py-md text-[#dee2ec]/50 font-medium rounded-xl active:scale-95 transition-transform"
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
