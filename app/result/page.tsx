'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { getTraitInfo } from '@/lib/scoring'
import ConfirmModal from '@/components/ConfirmModal'

type ResultData = {
  dominantTrait: string
  secondaryTrait: string
  scores: Record<string, number>
}

type StoredProfile = { id: string; tg_id: number; username: string | null }

const AUTHOR_USERNAME = 'evapatrakhina'

// Mixed trait names (client-side, for sending to author)
const MIXED_TRAIT_NAMES: Record<string, string> = {
  SU: 'S+U — Тихий тащитель',
  SP: 'S+P — Машина результата',
  RS: 'S+R — Опора для всех',
  KS: 'S+K — Железная система',
  PU: 'U+P — Идеальная для всех',
  RU: 'U+R — Спасатель',
  KU: 'U+K — Тревожный угодник',
  PR: 'P+R — Социальный идеал',
  KP: 'P+K — Тревожный достигатор',
  KR: 'R+K — Сканер угроз',
}

// Helper: get mixed trait key from scores
function getMixedTraitKey(scores: Record<string, number>): string {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (entries.length < 2) return ''
  const [first, second] = entries
  return [first[0], second[0]].sort().join('')
}

// Result images mapping
const RESULT_IMG: Record<string, string> = {
  S: '/hero.png',
  U: '/pleaser.png',
  P: '/perfectionist.png',
  R: '/stayer.png',
  K: '/controller.png',
}

// Survey questions
const SURVEY_Q1 = ['Деньги', 'Отношения', 'Здоровье', 'Другое', 'Везде']
const SURVEY_Q2 = ['Сильно мешает', 'Пока терпимо', 'Фоново']
const SURVEY_Q3 = ['Да, многое', 'Немного', 'Нет']

type FunnelStep =
  | 'result'
  | 'surprise-response-yes'
  | 'surprise-response-no'
  | 'cooldown-message'
  | 'referral-gate'
  | 'referral-link'
  | 'survey'
  | 'offer'
  | 'gift'
  | 'gift-claiming'

export default function ResultPage() {
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)

  // Funnel
  const [funnelStep, setFunnelStep] = useState<FunnelStep>('result')
  const [surpriseAnswer, setSurpriseAnswer] = useState<'yes' | 'no' | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<'yes' | 'no' | null>(null)

  // Survey
  const [surveyStep, setSurveyStep] = useState(0)
  const [surveyAnswers, setSurveyAnswers] = useState<string[]>([])

  // Referral
  const [refLink, setRefLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [userTgId, setUserTgId] = useState<number | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('eva_result')
    if (stored) {
      try { setResult(JSON.parse(stored)) } catch { /* ignore */ }
    }

    const fetchResult = () => {
      const token = localStorage.getItem('eva_token')
      if (!token) return
      fetch('/api/test/results', { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => r.json())
        .then((json: { success: boolean; data?: ResultData }) => {
          if (json.success && json.data) {
            setResult(json.data)
            sessionStorage.setItem('eva_result', JSON.stringify(json.data))
          }
        })
        .catch(() => { /* stays null */ })
    }

    if (!stored) fetchResult()
    setLoading(false)

    // Get user tg_id for referral link
    const profileRaw = localStorage.getItem('eva_profile')
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as StoredProfile
        setUserTgId(p.tg_id ?? null)
      } catch { /* ignore */ }
    }
  }, [])

  // ── Surprise answer (with custom modal) ───────────────────────────────
  const handleSurpriseAnswer = useCallback((answer: 'yes' | 'no') => {
    setPendingAnswer(answer)
    setShowConfirm(true)
  }, [])

  const handleConfirmProceed = useCallback(() => {
    setShowConfirm(false)
    if (pendingAnswer) {
      setSurpriseAnswer(pendingAnswer)
      setFunnelStep(pendingAnswer === 'yes' ? 'surprise-response-yes' : 'surprise-response-no')
      setPendingAnswer(null)
    }
  }, [pendingAnswer])

  const handleConfirmCancel = useCallback(() => {
    setShowConfirm(false)
    setPendingAnswer(null)
  }, [])

  // ── Cooldown screen buttons ──────────────────────────────────────────
  const handleCooldownButton = useCallback((goFast: boolean) => {
    if (goFast) {
      setFunnelStep('referral-gate')
    } else {
      setFunnelStep('survey')
    }
  }, [])

  // ── Referral gate: "Открыть за рекомендацию" ─────────────────────────
  const handleReferralGate = useCallback(() => {
    const link = userTgId
      ? `https://t.me/sprosievubot?start=ref_${userTgId}`
      : 'https://t.me/sprosievubot'
    setRefLink(link)
    setFunnelStep('referral-link')
  }, [userTgId])

  // ── Share via Telegram (multi-select) ────────────────────────────────────
  const handleShare = useCallback(() => {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Пройди этот тест и узнай, какой механизм снова и снова приводит тебя к одним и тем же проблемам.')}`
    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
    }).Telegram?.WebApp

    // Try native Web Share API first — on mobile it allows multi-select
    if (navigator.share) {
      navigator.share({
        title: 'EVA — Тест на опоры',
        text: 'Пройди этот тест и узнай свою внутреннюю опору!',
        url: refLink,
      }).catch(() => {
        // User cancelled share — fallback to Telegram share URL
        if (tgWebApp?.openTelegramLink) {
          tgWebApp.openTelegramLink(shareUrl)
        } else {
          window.open(shareUrl, '_blank')
        }
      })
    } else if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(shareUrl)
    } else {
      window.open(shareUrl, '_blank')
    }
  }, [refLink])

  // ── Copy link ────────────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      alert(`Скопируйте: ${refLink}`)
    }
  }, [refLink])

  // ── Survey ───────────────────────────────────────────────────────────
  const handleSurveyAnswer = useCallback((value: string) => {
    const next = [...surveyAnswers, value]
    setSurveyAnswers(next)
    if (surveyStep < 2) {
      setSurveyStep(surveyStep + 1)
    } else {
      setFunnelStep('offer')
    }
  }, [surveyAnswers, surveyStep])

  // ── Open Telegram DM ─────────────────────────────────────────────────
  const openTelegramDM = useCallback((prefill: string) => {
    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void; close?: () => void } }
    }).Telegram?.WebApp

    const dmUrl = `https://t.me/${AUTHOR_USERNAME}${prefill ? `?text=${encodeURIComponent(prefill)}` : ''}`

    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(dmUrl)
      // Auto-close after 500ms
      setTimeout(() => {
        tgWebApp?.close?.()
      }, 500)
    } else {
      window.open(dmUrl, '_blank')
    }
  }, [])

  // ── Proboy click: notify author then open Telegram ───────────────────
  const handleProboyClick = useCallback(() => {
    const profileRaw = localStorage.getItem('eva_profile')
    let userId: number | null = null
    let firstName: string | null = null
    let username: string | null = null
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as StoredProfile
        userId = p.tg_id ?? null
        username = p.username ?? null
      } catch { /* ignore */ }
    }

    const mixedKey = result ? getMixedTraitKey(result.scores) : ''
    const mixedTraitName = MIXED_TRAIT_NAMES[mixedKey] || 'Не определено'

    // Mark contact_author_clicked in DB
    if (userId) {
      fetch('/api/user/contact-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: userId }),
      }).catch((err) => console.error('[contact-author] Error:', err))
    }

    fetch('/api/notify-author', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        firstName,
        username,
        selectedFormat: 'Пробой',
        mixedTraitName,
      }),
    }).catch((err) => console.error('[notify-author] Error:', err))

    openTelegramDM('Пробой')
  }, [result, openTelegramDM])

  // ── Pyramid click: mark contact and open Telegram ────────────────────
  const handlePyramidClick = useCallback(() => {
    const profileRaw = localStorage.getItem('eva_profile')
    let userId: number | null = null
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as StoredProfile
        userId = p.tg_id ?? null
      } catch { /* ignore */ }
    }

    // Mark contact_author_clicked in DB
    if (userId) {
      fetch('/api/user/contact-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: userId }),
      }).catch((err) => console.error('[contact-author] Error:', err))
    }

    openTelegramDM('Пирамида')
  }, [openTelegramDM])

  // ── "Пока не готова" handler ─────────────────────────────────────────
  const handleNotReady = useCallback(() => {
    // Show intermediate gift screen
    setFunnelStep('gift')
  }, [])

  // ── "Забрать подарок" handler ────────────────────────────────────────
  const handleClaimGift = useCallback(async () => {
    // Get user's selected_sphere from profile
    const token = localStorage.getItem('eva_token')
    let selectedSphere = 'other'

    if (token) {
      try {
        const res = await fetch('/api/user/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (json.success && json.data?.selected_sphere) {
          selectedSphere = json.data.selected_sphere
        }
      } catch (err) {
        console.error('[claim-gift] Failed to fetch user status:', err)
      }
    }

    // Map sphere to app_settings key
    const sphereToKey: Record<string, string> = {
      'Деньги': 'gift_money',
      'Отношения': 'gift_relations',
      'Здоровье': 'gift_health',
      'Другое': 'gift_other',
      'Везде': 'gift_other',
    }
    const key = sphereToKey[selectedSphere] || 'gift_other'

    // Fetch gift link from app_settings
    let giftUrl = 'https://t.me/' + AUTHOR_USERNAME
    if (token) {
      try {
        const res = await fetch(`/api/gift-link?key=${encodeURIComponent(key)}`)
        const json = await res.json()
        if (json.success && json.data?.url) {
          giftUrl = json.data.url
        }
      } catch (err) {
        console.error('[claim-gift] Failed to fetch gift link:', err)
      }
    }

    // Also send gift message via bot (legacy)
    fetch('/api/bot/send-gift-message', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || ''}` },
    }).catch((err) => console.error('[send-gift-message] Error:', err))

    // Open gift link and close
    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openLink?: (url: string) => void; close?: () => void; openTelegramLink?: (url: string) => void } }
    }).Telegram?.WebApp

    if (tgWebApp?.openLink) {
      tgWebApp.openLink(giftUrl)
    } else if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(giftUrl)
    } else {
      window.open(giftUrl, '_blank')
    }

    // Show "Переходим к подарку..." then close after delay
    setFunnelStep('gift-claiming')

    // Auto-close after 2 seconds
    setTimeout(() => {
      tgWebApp?.close?.()
    }, 2000)
  }, [])

  // ── Loading / No result ──────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary">
        <motion.div
          className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </main>
    )
  }

  if (!result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <div className="text-center">
          <p className="text-text-primary text-lg font-medium">Результат не найден</p>
          <p className="text-text-secondary text-sm mt-2 mb-4">Пройдите тест, чтобы увидеть свою доминирующую опору.</p>
          <a href="/test" className="inline-block py-3 px-6 bg-accent text-white rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform">
            Пройти тест
          </a>
        </div>
      </main>
    )
  }

  const traitInfo = getTraitInfo(result.dominantTrait)
  const resultImgSrc = RESULT_IMG[result.dominantTrait] ?? '/hero.png'

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary">
      <div className="flex flex-col flex-1 px-5 pt-10 pb-8 max-w-sm mx-auto w-full gap-6">

        {/* ════════════ RESULT (dominant trait) ════════════ */}
        {funnelStep === 'result' && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative w-full max-h-[40vh] rounded-2xl overflow-hidden"
              style={{ minHeight: '200px' }}
            >
              <Image
                src={resultImgSrc}
                alt={`Результат: ${traitInfo.title}`}
                fill
                priority
                className="object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
              className="text-center"
            >
              <p className="text-text-muted text-xs uppercase tracking-widest mb-3">
                Ваша доминирующая опора
              </p>
              <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-tight" style={{ color: 'var(--accent)' }}>
                {traitInfo.title}
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-bg-secondary rounded-xl p-5 border border-border"
            >
              <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">{traitInfo.description}</p>
            </motion.div>

            {/* Surprise question */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="text-center"
            >
              <p className="text-text-primary text-[16px] font-medium mb-3">
                Удивил ли тебя результат?
              </p>
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: 'var(--accent)' }}
                  onClick={() => handleSurpriseAnswer('yes')}
                >
                  Да
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => handleSurpriseAnswer('no')}
                >
                  Нет
                </motion.button>
              </div>
            </motion.div>
          </>
        )}

        {/* ════════════ SURPRISE RESPONSE — YES ════════════ */}
        {funnelStep === 'surprise-response-yes' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="relative w-full max-h-[30vh] mb-4 rounded-2xl overflow-hidden" style={{ minHeight: '160px' }}>
                <Image src={resultImgSrc} alt={traitInfo.title} fill className="object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </div>
              <h1 className="text-[24px] font-bold" style={{ color: 'var(--accent)' }}>{traitInfo.title}</h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-bg-secondary rounded-xl p-5 border border-border"
            >
              <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">{traitInfo.description}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-center"
            >
              <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-5">
                Это нормально. Более того — это и есть часть механизма. Искажённая опора устроена так, что ты не видишь её напрямую. И именно поэтому снова и снова оказываешься в одних и тех же ситуациях.
              </p>
              <p className="text-text-secondary text-[14px] leading-relaxed mb-5 whitespace-pre-wrap">
                Базовая опора — это только часть картины. Есть ещё смешанные конфигурации, которые активируются в стрессе.{' '}
                <b>Хочешь увидеть свою вторую искаженную опору?</b>
              </p>
              <div className="flex gap-3">
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: 'var(--accent)' }}
                  onClick={() => setFunnelStep('referral-gate')}>
                  Да!!!
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => setFunnelStep('cooldown-message')}>
                  Не сегодня
                </motion.button>
              </div>
            </motion.div>
          </>
        )}

        {/* ════════════ SURPRISE RESPONSE — NO ════════════ */}
        {funnelStep === 'surprise-response-no' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="relative w-full max-h-[30vh] mb-4 rounded-2xl overflow-hidden" style={{ minHeight: '160px' }}>
                <Image src={resultImgSrc} alt={traitInfo.title} fill className="object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </div>
              <h1 className="text-[24px] font-bold" style={{ color: 'var(--accent)' }}>{traitInfo.title}</h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-bg-secondary rounded-xl p-5 border border-border"
            >
              <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">{traitInfo.description}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-center"
            >
              <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-5">
                Это говорит о том, что ты уже явно не новичок в самопознании. Ты видишь этот паттерн, но это еще не меняет ситуацию.
              </p>
              <p className="text-text-secondary text-[14px] leading-relaxed mb-5 whitespace-pre-wrap">
                Базовая опора — это только часть картины. Есть ещё смешанные конфигурации, которые активируются в стрессе.{' '}
                <b>Хочешь увидеть свою вторую искаженную опору?</b>
              </p>
              <div className="flex gap-3">
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: 'var(--accent)' }}
                  onClick={() => setFunnelStep('referral-gate')}>
                  Да!!!
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => setFunnelStep('cooldown-message')}>
                  Не сегодня
                </motion.button>
              </div>
            </motion.div>
          </>
        )}

        {/* ════════════ COOLDOWN MESSAGE ════════════ */}
        {funnelStep === 'cooldown-message' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-6">
              Сейчас нет смысла проходить тест повторно. У тебя есть 2 месяца, чтобы демонтировать текущую опору. Через 2 месяца ты сможешь увидеть изменения.
            </p>
            <div className="flex flex-col gap-3">
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => handleCooldownButton(true)}>
                Узнать 2 опору сейчас
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                onClick={() => handleCooldownButton(true)}>
                🎁 Пригласить друга — получить приз
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] border"
                style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                onClick={() => handleCooldownButton(false)}>
                Узнаю через 2 месяца
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ════════════ REFERRAL GATE ════════════ */}
        {funnelStep === 'referral-gate' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-5">
              <b>Я обычно открываю этот слой только тем, кто идёт в работу.</b>{'\n'}
              Потому что важно не просто увидеть, а понять, как это устроено и что с этим делать.
              {'\n\n'}
              🔥 <b>Сейчас у тебя есть возможность открыть свою теневую опору через участие</b>
            </p>
            <motion.button type="button" whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
              style={{ background: 'var(--accent)' }}
              onClick={handleReferralGate}>
              Открыть за рекомендацию
            </motion.button>
          </motion.div>
        )}

        {/* ════════════ REFERRAL LINK ════════════ */}
        {funnelStep === 'referral-link' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-4">
              Ты можешь получить разбор своей второй опоры, если поделишься тестом с 2 подругами. Для этого тебе нужно скопировать ссылку и отправить подругам. Когда они пройдут тест, тебе придёт ответ.
              {'\n\n'}
              <i>Я даю этот доступ в обмен на расширение проекта</i>
            </p>

            {/* Referral link box */}
            <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
              <div className="flex items-center gap-2">
                <p className="text-accent text-[13px] break-all select-all flex-1">{refLink}</p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  className="flex-shrink-0 p-2 rounded-lg bg-bg-primary border border-border hover:border-accent transition-colors"
                  onClick={handleCopyLink}
                  title="Скопировать"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Motivational referral text */}
            <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
              <p className="text-text-secondary text-[14px] leading-relaxed whitespace-pre-wrap">
                Чем больше друзей ты позовёшь, тем больше подарков и призов ты получишь! Каждый месяц у нас проходит розыгрыш среди тех, кто пригласил больше всех. За 5 приглашенных друзей — очень приятный приз 🎁. За 10 друзей — личная консультация бесплатно 🌟.
              </p>
            </div>

            <p className="text-text-secondary text-[14px] leading-relaxed mb-5">
              Когда 2 человека перейдут по ней и пройдут тест, я открою тебе второй слой — твою теневую опору.
            </p>
            <div className="flex flex-col gap-3">
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={handleShare}>
                Поделиться
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => setFunnelStep('survey')}>
                Дальше — больше
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ════════════ SURVEY ════════════ */}
        {funnelStep === 'survey' && surveyStep < 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-6">
              Ты сейчас увидела механизм. И, скорее всего, это не первый раз, когда ты что-то про себя понимаешь. Вопрос в другом: почему это до сих пор не меняет твою жизнь? Потому что понимание не демонтирует паттерн. Это делается только через работу.
            </p>

            <div className="bg-bg-secondary rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-text-muted">Вопрос {surveyStep + 1} из 3</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`w-6 h-1 rounded-full transition-colors ${i <= surveyStep ? 'bg-accent' : 'bg-bg-tertiary'}`} />
                  ))}
                </div>
              </div>

              {surveyStep === 0 && (
                <div>
                  <p className="text-[17px] font-medium text-text-primary mb-4">
                    В какой сфере ты сейчас сильнее всего чувствуешь напряжение?
                  </p>
                  <div className="flex flex-col gap-2">
                    {SURVEY_Q1.map((opt) => (
                      <button key={opt} type="button"
                        className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                        onClick={() => handleSurveyAnswer(opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}

              {surveyStep === 1 && (
                <div>
                  <p className="text-[17px] font-medium text-text-primary mb-4">
                    Насколько это ощущается остро?
                  </p>
                  <div className="flex flex-col gap-2">
                    {SURVEY_Q2.map((opt) => (
                      <button key={opt} type="button"
                        className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                        onClick={() => handleSurveyAnswer(opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}

              {surveyStep === 2 && (
                <div>
                  <p className="text-[17px] font-medium text-text-primary mb-4">
                    Ты уже пробовала что-то с этим делать?
                  </p>
                  <div className="flex flex-col gap-2">
                    {SURVEY_Q3.map((opt) => (
                      <button key={opt} type="button"
                        className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                        onClick={() => handleSurveyAnswer(opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ════════════ OFFER ════════════ */}
        {funnelStep === 'offer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-6">
              Есть 2 способа работы с искаженной опорой:{'\n\n'}
              ✓ Жёсткий, но быстрый — это группа «Пробой»{'\n'}
              ✓ Мягкий и постепенный — это «Пирамида Потенциала» или персональная работа{'\n\n'}
              Какой способ тебе ближе?
            </p>
            <div className="flex flex-col gap-3">
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => {
                  handleProboyClick()
                }}>
                Жёсткий быстрый
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] border"
                style={{ background: 'transparent', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onClick={handlePyramidClick}>
                Мягкий постепенный
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-[14px] text-text-muted"
                onClick={handleNotReady}>
                Пока не готова
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ════════════ GIFT SCREEN ════════════ */}
        {funnelStep === 'gift' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-bg-secondary rounded-xl p-5 border text-center"
            style={{ borderColor: 'color-mix(in srgb, var(--success) 40%, var(--border))' }}
          >
            <p className="text-success text-[17px] font-medium mb-3">
              ♡ Благодарю тебя за честность!
            </p>
            <p className="text-text-secondary text-[14px] leading-relaxed whitespace-pre-wrap mb-5">
              Честность — это то, на чем строятся все мои методы работы.{'\n\n'}
              Чтобы тест не остался просто тестом, я дарю тебе практику по твоей напряжённой сфере. Ты можешь начать изменения уже сегодня.
            </p>
            <motion.button type="button" whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
              style={{ background: 'var(--accent)' }}
              onClick={handleClaimGift}>
              🎁 Забрать подарок
            </motion.button>
          </motion.div>
        )}

        {/* ════════════ GIFT CLAIMING SCREEN ════════════ */}
        {funnelStep === 'gift-claiming' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-bg-secondary rounded-xl p-6 border text-center"
            style={{ borderColor: 'color-mix(in srgb, var(--success) 40%, var(--border))' }}
          >
            <motion.div
              className="text-5xl mb-4"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            >
              🎁
            </motion.div>
            <p className="text-text-primary text-[17px] font-semibold mb-2">
              Переходим к подарку...
            </p>
            <p className="text-text-muted text-[13px]">
              Сейчас откроется ссылка на практику. Подожди немного.
            </p>
          </motion.div>
        )}

        {/* Confirm Modal */}
        <ConfirmModal
          open={showConfirm}
          title="Уверена?"
          message="Ты не сможешь изменить свой ответ."
          confirmText="Подтвердить"
          cancelText="Отмена"
          onConfirm={handleConfirmProceed}
          onCancel={handleConfirmCancel}
        />

        <div className="flex-1" />
      </div>
    </main>
  )
}
