'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { getTraitInfo } from '@/lib/scoring'

type ResultData = {
  dominantTrait: string
  secondaryTrait: string
  scores: Record<string, number>
}

type StoredProfile = { id: string; tg_id: number; username: string | null }

const REFERRALS_NEEDED = 2
const ADMIN_USERNAME = process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? 'eva_admin_bot'

// Result images mapping per task spec
const RESULT_IMG: Record<string, string> = {
  S: '/hero.png',
  U: '/pleaser.png',
  P: '/perfectionist.png',
  R: '/stayer.png',
  K: '/controller.png',
}

// ── Qualification questions (Stage 5 per t3.md) ────────────────────────────

const QUAL_SPHERES = ['Деньги', 'Отношения', 'Здоровье', 'Самореализация', 'Везде']
const QUAL_LEVELS = ['Сильно мешает', 'Пока терпимо', 'Фоново']
const QUAL_ATTEMPTS = ['Да, многое', 'Немного', 'Нет']

type FunnelStep =
  | 'result'             // show result image + description
  | 'surprise'           // "Удивил ли тебя результат?" Да/Нет
  | 'surprise-response'  // show response text + "Напиши мне" / "Далее ➔"
  | 'qualification'      // Stage 5: 3 questions
  | 'offer'              // Stage 6: two formats + "Пока не готова"
  | 'gift'               // "Пока не готова" → thank you + gift button
  | 'qual-done'          // qualification submitted

export default function ResultPage() {
  const [result, setResult]   = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refCount, setRefCount] = useState(0)
  const [copied, setCopied]     = useState(false)

  // Funnel state
  const [funnelStep, setFunnelStep] = useState<FunnelStep>('result')
  const [surpriseAnswer, setSurpriseAnswer] = useState<'yes' | 'no' | null>(null)
  const [qualStep, setQualStep] = useState(0)
  const [qualAnswers, setQualAnswers] = useState<{
    tension_sphere: string
    tension_level: string
    previous_attempts: string
  }>({ tension_sphere: '', tension_level: '', previous_attempts: '' })
  const [qualSubmitting, setQualSubmitting] = useState(false)

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

    // Fetch referral count
    const tkn = localStorage.getItem('eva_token')
    if (!tkn) return
    fetch('/api/referrals', { headers: { Authorization: 'Bearer ' + tkn } })
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { count: number } }) => {
        if (json.success && typeof json.data?.count === 'number') {
          setRefCount(json.data.count)
        }
      })
      .catch(() => { /* stays 0 */ })
  }, [])

  // ── Surprise answer handler ───────────────────────────────────────────
  const handleSurpriseAnswer = useCallback((answer: 'yes' | 'no') => {
    if (surpriseAnswer) return // already answered once
    const confirmed = window.confirm('Уверена?')
    if (!confirmed) return
    setSurpriseAnswer(answer)
    setFunnelStep('surprise-response')
  }, [surpriseAnswer])

  // ── Go to qualification (Stage 5) ─────────────────────────────────────
  const goToQualification = useCallback(() => {
    setFunnelStep('qualification')
    setQualStep(0)
    setQualAnswers({ tension_sphere: '', tension_level: '', previous_attempts: '' })
  }, [])

  // ── Qualification answer handler ──────────────────────────────────────
  const handleQualAnswer = useCallback(
    (value: string) => {
      if (qualStep === 0) {
        setQualAnswers((prev) => ({ ...prev, tension_sphere: value }))
      } else if (qualStep === 1) {
        setQualAnswers((prev) => ({ ...prev, tension_level: value }))
      } else {
        setQualAnswers((prev) => ({ ...prev, previous_attempts: value }))
      }

      if (qualStep < 2) {
        setQualStep((s) => s + 1)
      } else {
        submitQualification({
          tension_sphere: qualAnswers.tension_sphere,
          tension_level: qualAnswers.tension_level,
          previous_attempts: value,
        })
      }
    },
    [qualStep, qualAnswers],
  )

  // ── Submit qualification to backend ───────────────────────────────────
  async function submitQualification(finalAnswers: {
    tension_sphere: string
    tension_level: string
    previous_attempts: string
  }) {
    setQualSubmitting(true)
    try {
      const token = localStorage.getItem('eva_token') || ''
      const res = await fetch('/api/qualification/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(finalAnswers),
      })

      const data = await res.json()
      console.log('[submitQualification] response:', data)
      // Show offer screen regardless of backend result
      setFunnelStep('offer')
    } catch (err) {
      console.error('Qualification error:', err)
      setFunnelStep('offer')
    } finally {
      setQualSubmitting(false)
    }
  }

  // ── Referral share ────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const profileRaw = localStorage.getItem('eva_profile')
    let userId: number | null = null
    if (profileRaw) {
      try { userId = (JSON.parse(profileRaw) as StoredProfile).tg_id } catch { /* ignore */ }
    }
    const link = userId ? `https://t.me/sprosievubot?start=ref_${userId}` : 'https://t.me/sprosievubot'
    const shareText = 'Пройди этот тест и узнай свою внутреннюю опору!'
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'EVA', text: shareText, url: link })
        return
      } catch { /* cancelled */ }
    }

    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
    }).Telegram?.WebApp

    if (tgWebApp?.openTelegramLink) {
      try { tgWebApp.openTelegramLink(shareUrl); return } catch { /* fallback */ }
    }

    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      alert(`Скопируйте: ${link}`)
    }
  }, [])

  // ── Open Telegram DM with pre-filled text ─────────────────────────────
  const openTelegramDM = useCallback((prefill: string) => {
    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
    }).Telegram?.WebApp

    const dmUrl = `https://t.me/${ADMIN_USERNAME}?text=${encodeURIComponent(prefill)}`

    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(dmUrl)
    } else {
      window.open(dmUrl, '_blank')
    }
  }, [])

  // ── Loading / No result ───────────────────────────────────────────────
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

  const traitInfo    = getTraitInfo(result.dominantTrait)
  const secTraitInfo = getTraitInfo(result.secondaryTrait)
  const resultImgSrc = RESULT_IMG[result.dominantTrait] ?? '/hero.png'
  const isUnlocked   = refCount >= REFERRALS_NEEDED

  const surpriseResponseText = surpriseAnswer === 'yes'
    ? 'Видишь, а ты и не предполагала почему иногда действуешь так или иначе, но с этим можно разобраться.'
    : 'Ты знаешь почему ты так действуешь! и ты знаешь что ты с этим можешь разобраться.'

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary">
      <div className="flex flex-col flex-1 px-5 pt-10 pb-8 max-w-sm mx-auto w-full gap-6">

        {/* ════════════ RESULT SCREEN (Stage 3) ════════════ */}
        {funnelStep === 'result' && (
          <>
            {/* Result image */}
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
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </motion.div>

            {/* Title */}
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
              <p className="text-text-secondary text-sm mt-2 leading-relaxed">{traitInfo.subtitle}</p>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-bg-secondary rounded-xl p-5 border border-border"
            >
              <p className="text-text-primary text-[15px] leading-relaxed">{traitInfo.description}</p>
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

            {/* Referral block */}
            {!isUnlocked && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="rounded-xl p-5 border border-border bg-bg-secondary"
              >
                <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
                  Вторичная опора
                </p>
                <div className="flex gap-1.5 mb-3">
                  {Array.from({ length: REFERRALS_NEEDED }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full transition-colors duration-500"
                      style={{ background: i < refCount ? 'var(--accent)' : 'var(--bg-tertiary)' }}
                    />
                  ))}
                </div>
                <p className="text-text-secondary text-[14px] leading-relaxed mb-4">
                  Пригласите{' '}
                  <span className="text-text-primary font-medium">
                    {REFERRALS_NEEDED - refCount}{' '}
                    {REFERRALS_NEEDED - refCount === 1 ? 'друга' : 'друзей'}
                  </span>
                  , чтобы увидеть вторичную опору — <span className="font-semibold text-text-muted">???</span>.
                </p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleShare}
                  className="w-full py-3 rounded-xl font-semibold text-[15px] text-white select-none"
                  style={{ background: 'var(--accent)' }}
                >
                  {copied ? 'Ссылка скопирована!' : 'Пригласить друзей'}
                </motion.button>
              </motion.div>
            )}
          </>
        )}

        {/* ════════════ SURPRISE RESPONSE ════════════ */}
        {funnelStep === 'surprise-response' && surpriseAnswer !== null && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              {/* Mini result image */}
              <div className="relative w-full max-h-[30vh] mb-4 rounded-2xl overflow-hidden" style={{ minHeight: '160px' }}>
                <Image
                  src={resultImgSrc}
                  alt={traitInfo.title}
                  fill
                  className="object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>

              <h1 className="text-[24px] font-bold" style={{ color: 'var(--accent)' }}>{traitInfo.title}</h1>
              <p className="text-text-secondary text-sm mt-2">{traitInfo.subtitle}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-bg-secondary rounded-xl p-5 border border-border"
            >
              <p className="text-text-primary text-[15px] leading-relaxed">{traitInfo.description}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-center"
            >
              <p className="text-text-primary text-[15px] leading-relaxed italic mb-4">{surpriseResponseText}</p>

              <div className="flex flex-col gap-2.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: 'var(--accent)' }}
                  onClick={() => openTelegramDM('')}
                >
                  💬 Напиши мне
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={goToQualification}
                >
                  Далее ➔
                </motion.button>
              </div>
            </motion.div>
          </>
        )}

        {/* ════════════ STAGE 5: QUALIFICATION ════════════ */}
        {funnelStep === 'qualification' && !qualSubmitting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-bg-secondary rounded-xl p-5 border border-border"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-medium text-text-muted">Вопрос {qualStep + 1} из 3</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`w-6 h-1 rounded-full transition-colors ${i <= qualStep ? 'bg-accent' : 'bg-bg-tertiary'}`} />
                ))}
              </div>
            </div>

            {qualStep === 0 && (
              <div>
                <p className="text-[17px] font-medium text-text-primary mb-4">
                  В какой сфере сильнее чувствуется напряжение?
                </p>
                <div className="flex flex-col gap-2">
                  {QUAL_SPHERES.map((option) => (
                    <button key={option} type="button"
                      className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                      onClick={() => handleQualAnswer(option)}>{option}</button>
                  ))}
                </div>
              </div>
            )}

            {qualStep === 1 && (
              <div>
                <p className="text-[17px] font-medium text-text-primary mb-4">
                  Насколько остро это ощущается?
                </p>
                <div className="flex flex-col gap-2">
                  {QUAL_LEVELS.map((option) => (
                    <button key={option} type="button"
                      className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                      onClick={() => handleQualAnswer(option)}>{option}</button>
                  ))}
                </div>
              </div>
            )}

            {qualStep === 2 && (
              <div>
                <p className="text-[17px] font-medium text-text-primary mb-4">
                  Пробовала ли что-то делать?
                </p>
                <div className="flex flex-col gap-2">
                  {QUAL_ATTEMPTS.map((option) => (
                    <button key={option} type="button"
                      className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                      onClick={() => handleQualAnswer(option)}>{option}</button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {qualSubmitting && (
          <div className="flex justify-center py-8">
            <motion.div
              className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {/* ════════════ STAGE 6: OFFER ════════════ */}
        {funnelStep === 'offer' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-primary text-[17px] font-medium leading-relaxed mb-6">
              На основе твоих ответов я вижу два формата работы, которые тебе помогут:
            </p>

            <div className="flex flex-col gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-xl font-semibold text-[16px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => openTelegramDM('Пробой')}
              >
                🔥 Быстрый формат работы
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-xl font-semibold text-[16px] border"
                style={{ background: 'transparent', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onClick={() => openTelegramDM('Пирамида')}
              >
                🌱 Мягкий формат работы
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-[14px] text-text-muted"
                onClick={() => setFunnelStep('gift')}
              >
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
              ♡ Спасибо за честность!
            </p>
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              Я ценю, что ты была искренней. В подарок дарю тебе практику, которая поможет немного прояснить ситуацию.
            </p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
              style={{ background: 'var(--accent)' }}
              onClick={() => openTelegramDM('Хочу забрать подарок')}
            >
              🎁 Забрать подарок
            </motion.button>
          </motion.div>
        )}

        <div className="flex-1" />
      </div>
    </main>
  )
}
