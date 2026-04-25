'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getTraitInfo } from '@/lib/scoring'

// Standard imports for initial bundle
import ResultScreen from '@/components/results/ResultScreen'

// Dynamic imports for deferred steps
const SurpriseResponseScreen = dynamic(() => import('@/components/results/SurpriseResponseScreen'), { ssr: false })
const CooldownScreen = dynamic(() => import('@/components/results/CooldownScreen'), { ssr: false })
const ReferralGateScreen = dynamic(() => import('@/components/results/ReferralGateScreen'), { ssr: false })
const ReferralLinkScreen = dynamic(() => import('@/components/results/ReferralLinkScreen'), { ssr: false })
const ConfirmModal = dynamic(() => import('@/components/ConfirmModal'), { ssr: false })

const THINKING_DELAY = 1000 // ms

type ResultData = {
  dominantTrait: string
  secondaryTrait: string
  scores: Record<string, number>
}

type StoredProfile = { id: string; tg_id: number; username: string | null }

// Result images mapping
const RESULT_IMG: Record<string, string> = {
  S: '/hero.png',
  U: '/pleaser.png',
  P: '/perfectionist.png',
  R: '/stayer.png',
  K: '/controller.png',
}

type FunnelStep =
  | 'result'
  | 'surprise-response-yes'
  | 'surprise-response-no'
  | 'cooldown-message'
  | 'referral-gate'
  | 'referral-link'

function ResultLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </main>
  )
}

function ResultContent() {
  const searchParams = useSearchParams()
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const responseRef = useRef<HTMLDivElement>(null)

  // Funnel
  const [funnelStep, setFunnelStep] = useState<FunnelStep>('result')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<'yes' | 'no' | null>(null)

  // Referral
  const [refLink, setRefLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [userTgId, setUserTgId] = useState<number | null>(null)
  const [shareUsed, setShareUsed] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const fetchWithRetry = useCallback(async (retry = true) => {
    let token = localStorage.getItem('eva_token')
    
    if (!token) {
      if (retry) {
        console.log('[result] No token found, retrying in 500ms...')
        setTimeout(() => fetchWithRetry(false), 500)
      } else {
        setLoading(false)
        setAuthError(true)
      }
      return
    }

    try {
      const r = await fetch('/api/test/results', { 
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store'
      })
      const json = await r.json()

      // Silent Re-auth logic
      if (r.status === 401 || json.error === 'Missing or invalid authorization') {
        if (retry) {
          console.warn('[result] Token expired, attempting silent re-auth...')
          const initData = (window as any).Telegram?.WebApp?.initData
          if (initData) {
            const authRes = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData })
            })
            const authJson = await authRes.json()
            if (authJson.success && authJson.token) {
              localStorage.setItem('eva_token', authJson.token)
              // Retry the fetch one last time with new token
              return fetchWithRetry(false)
            }
          }
        }
        
        // If re-auth failed or already retried
        console.error('[result] Auth completely failed')
        localStorage.removeItem('eva_token')
        setAuthError(true)
        setLoading(false)
        return
      }

      if (json.success && json.data) {
        setResult(json.data)
        // sessionStorage — только для мгновенной отрисовки сразу после прохождения теста. Источник истины — API.
        sessionStorage.setItem('eva_result', JSON.stringify(json.data))
      }
    } catch (err) {
      console.error('[result] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // We use sessionStorage for results to provide instant flicker-free rendering 
    // after test submission, while still allowing a fresh fetch on new app sessions
    // to ensure data consistency. Long-term tokens are kept in localStorage.
    const stored = sessionStorage.getItem('eva_result')
    if (stored) {
      try { 
        setResult(JSON.parse(stored)) 
        setLoading(false) // Show stored immediately to prevent flicker
      } catch { /* ignore */ }
    }

    fetchWithRetry()

    // Get user tg_id for referral link
    const profileRaw = localStorage.getItem('eva_profile')
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as StoredProfile
        setUserTgId(p.tg_id ?? null)
      } catch { /* ignore */ }
    } else {
      // Try to get from Telegram WebApp directly if profile not in storage yet
      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      if (tgUser?.id) {
        setUserTgId(tgUser.id)
      }
    }

    // Check for prior share action
    if (localStorage.getItem('eva_shared_at')) {
      setShareUsed(true)
    }

    // Auto-navigate to referral screen if coming from "Забрать приз" button
    if (searchParams.get('referral') === '1') {
      setFunnelStep('referral-gate')
    }
  }, [searchParams, fetchWithRetry])

  useEffect(() => {
    // If we're in referral mode but have no result data, ensure we don't try to show 'result' step
    if (searchParams.get('referral') === '1' && !result && funnelStep === 'result') {
      setFunnelStep('referral-gate')
    }
  }, [searchParams, result, funnelStep])

  useEffect(() => {
    if ((funnelStep === 'surprise-response-yes' || funnelStep === 'surprise-response-no') && responseRef.current) {
      const timer = setTimeout(() => {
        responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [funnelStep])

  // ── Surprise answer (with custom modal) ───────────────────────────────
  const handleSurpriseAnswer = useCallback((answer: 'yes' | 'no') => {
    setPendingAnswer(answer)
    setShowConfirm(true)
  }, [])

  const handleConfirmProceed = useCallback(() => {
    setShowConfirm(false)
    if (pendingAnswer) {
      setIsThinking(true)
      
      setTimeout(() => {
        setIsThinking(false)
        setFunnelStep(pendingAnswer === 'yes' ? 'surprise-response-yes' : 'surprise-response-no')
      }, THINKING_DELAY)
      
      setPendingAnswer(null)
    }
  }, [pendingAnswer])

  const handleConfirmCancel = useCallback(() => {
    setShowConfirm(false)
    setPendingAnswer(null)
  }, [])

  // ── Cooldown screen buttons ──────────────────────────────────────────
  const handleCooldownButton = useCallback(() => {
    setFunnelStep('referral-gate')
  }, [])

  // ── Referral gate: "Открыть за рекомендацию" ─────────────────────────
  const handleReferralGate = useCallback(() => {
    // Last ditch effort to get TG ID
    let finalTgId = userTgId
    if (!finalTgId) {
      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      if (tgUser?.id) {
        finalTgId = tgUser.id
        setUserTgId(tgUser.id)
      }
    }

    if (!finalTgId) {
      alert('Ошибка: Не удалось определить ваш Telegram ID. Пожалуйста, перезапустите приложение.')
      return
    }

    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'sprosievubot'
    const link = `https://t.me/${botUsername}?start=ref_${finalTgId}`
    setRefLink(link)
    setFunnelStep('referral-link')
  }, [userTgId])

  // ── Share via Telegram: call API to trigger bot messages, then close ──
  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (shareUsed || isSharing) return

    const WebApp = (window as any).Telegram?.WebApp
    const currentTgId = WebApp?.initDataUnsafe?.user?.id ?? userTgId

    if (!currentTgId) {
      alert('Ошибка: Не удалось определить ID пользователя.')
      return
    }

    setIsSharing(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tgId: currentTgId, 
          trait: result?.dominantTrait,
          link: refLink // Sending the exact link shown to user
        }),
      })
      
      if (!res.ok) throw new Error('API failed')

      // Success
      setShareUsed(true)
      localStorage.setItem('eva_shared_at', new Date().toISOString())
      
      if (WebApp?.close) {
        WebApp.close()
      }
    } catch (err) {
      console.error('[share] API call failed:', err)
      alert('Не удалось отправить рекомендацию. Пожалуйста, попробуйте еще раз или просто скопируйте ссылку.')
    } finally {
      setIsSharing(false)
    }
  }, [result, shareUsed, isSharing, userTgId, refLink])


  // ── Copy link ────────────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert(`Скопируйте: ${refLink}`)
    }
  }, [refLink])

  // ── Close Mini App ───────────────────────────────────────────────────
  const closeApp = useCallback(() => {
    if (typeof window !== 'undefined') {
      (window as any).Telegram?.WebApp?.close?.()
    }
  }, [])

  const reauthAndRetry = useCallback(() => {
    setLoading(true)
    setAuthError(false)
    fetchWithRetry()
  }, [fetchWithRetry])


  // ── Loading / No result ──────────────────────────────────────────────
  if (loading) {
    return <ResultLoading />
  }

  // ── Referral-only mode (from "Забрать приз" button) ──
  const isReferralMode = searchParams.get('referral') === '1'

  if (!isReferralMode && !result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <div className="text-center">
          <p className="text-text-primary text-lg font-medium">Результат не найден</p>
          <p className="text-text-secondary text-sm mt-2 mb-6">
            {authError 
              ? 'Сессия истекла. Пожалуйста, авторизуйтесь заново.' 
              : 'Пройдите тест, чтобы увидеть свою доминирующую опору.'}
          </p>
          {authError ? (
            <button 
              onClick={reauthAndRetry}
              className="inline-block py-3 px-6 bg-accent text-white rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform">
              Войти заново
            </button>
          ) : (
            <a href="/test" className="inline-block py-3 px-6 bg-accent text-white rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform">
              Пройти тест
            </a>
          )}
        </div>
      </main>
    )
  }

  const traitInfo = result ? getTraitInfo(result.dominantTrait) : null
  const resultImgSrc = result ? (RESULT_IMG[result.dominantTrait] ?? '/hero.png') : '/hero.png'

  // Safe accessors — only non-null when result exists
  const tTitle = traitInfo?.title ?? ''
  const tDescription = traitInfo?.description ?? ''
  const tTrait = result?.dominantTrait ?? '?'

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary">
      <div className="flex flex-col flex-1 px-5 pt-10 pb-8 max-w-sm mx-auto w-full gap-6">

        {/* ════════════ MAIN FUNNEL SWITCH ════════════ */}
        
        {funnelStep === 'result' && (
          <ResultScreen 
            imgSrc={resultImgSrc} 
            title={tTitle} 
            description={tDescription} 
            trait={tTrait}
            isThinking={isThinking}
            onAnswer={handleSurpriseAnswer}
          />
        )}

        {(funnelStep === 'surprise-response-yes' || funnelStep === 'surprise-response-no') && (
          <SurpriseResponseScreen
            imgSrc={resultImgSrc}
            title={tTitle}
            description={tDescription}
            trait={tTrait}
            type={funnelStep === 'surprise-response-yes' ? 'yes' : 'no'}
            responseRef={responseRef}
            onNext={() => setFunnelStep('referral-gate')}
            onCancel={() => setFunnelStep('cooldown-message')}
          />
        )}

        {funnelStep === 'cooldown-message' && (
          <CooldownScreen 
            onConfirm={handleCooldownButton} 
            onClose={closeApp} 
          />
        )}

        {funnelStep === 'referral-gate' && (
          <ReferralGateScreen 
            onConfirm={handleReferralGate} 
            onClose={closeApp} 
          />
        )}

        {funnelStep === 'referral-link' && (
          <ReferralLinkScreen
            refLink={refLink}
            copied={copied}
            onCopy={handleCopyLink}
            onShare={handleShare}
          />
        )}

        {/* Confirm Modal (Loaded dynamically when needed) */}
        {showConfirm && (
          <ConfirmModal
            open={showConfirm}
            title="Уверена?"
            message="Ты не сможешь изменить свой ответ."
            confirmText="Подтвердить"
            cancelText="Отмена"
            onConfirm={handleConfirmProceed}
            onCancel={handleConfirmCancel}
          />
        )}

        <div className="flex-1" />
      </div>
    </main>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={<ResultLoading />}>
      <ResultContent />
    </Suspense>
  )
}
