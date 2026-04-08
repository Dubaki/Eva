'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTraitInfo } from '@/lib/scoring'
import { getReferralLink, shareReferralLink } from '@/lib/referral'

type ResultData = {
  dominantTrait: string
  secondaryTrait: string
  scores: Record<string, number>
}

type StoredProfile = { id: string; tg_id: number; username: string | null }

const REFERRALS_NEEDED = 2

const TRAIT_LABELS: Record<string, string> = {
  S: 'Самоценность',
  U: 'Перфекционизм',
  P: 'Угодничество',
  R: 'Контроль',
  K: 'Сверхбдительность',
}

const TRAIT_COLORS: Record<string, string> = {
  S: 'var(--scale-s)',
  U: 'var(--scale-u)',
  P: 'var(--scale-p)',
  R: 'var(--scale-r)',
  K: 'var(--scale-k)',
}

const SCALE_ORDER = ['S', 'U', 'P', 'R', 'K'] as const
const MAX_SCORE = 25

// ── Qualification questions ────────────────────────────────────────────────

const QUAL_SPHERES = ['Деньги', 'Отношения', 'Здоровье', 'Самореализация', 'Другое']
const QUAL_LEVELS = ['Лёгкое напряжение', 'Среднее', 'Сильное', 'Критическое']
const QUAL_ATTEMPTS = ['Нет, впервые', 'Читал(а) книги', 'Работал(а) с психологом', 'Пробовал(а) другие методы']

export default function ResultPage() {
  const [result, setResult]   = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refCount, setRefCount] = useState(0)
  const [refLink, setRefLink]   = useState('')
  const [copied, setCopied]     = useState(false)

  // Qualification state
  const [showQualification, setShowQualification] = useState(false)
  const [qualStep, setQualStep] = useState(0)
  const [qualAnswers, setQualAnswers] = useState<{
    tension_sphere: string
    tension_level: string
    previous_attempts: string
  }>({ tension_sphere: '', tension_level: '', previous_attempts: '' })
  const [qualSubmitting, setQualSubmitting] = useState(false)
  const [qualDone, setQualDone] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('eva_result')
    if (stored) {
      try { setResult(JSON.parse(stored)) } catch { /* ignore */ }
    }
    setLoading(false)

    // Load tg_id for referral link generation
    const profileRaw = localStorage.getItem('eva_profile')
    if (profileRaw) {
      try {
        const profile = JSON.parse(profileRaw) as StoredProfile
        const link = profile.tg_id ? getReferralLink(profile.tg_id) : ''
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'eva_bot'
        setRefLink(link || `https://t.me/${botUsername}`)
      } catch { /* ignore */ }
    }

    // Fetch referral count
    const token = localStorage.getItem('eva_token')
    if (!token) return
    fetch('/api/referrals', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { count: number } }) => {
        if (json.success && typeof json.data?.count === 'number') {
          setRefCount(json.data.count)
        }
      })
      .catch(() => { /* stays 0 */ })
  }, [])

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

  const handleShare = useCallback(async () => {
    if (!refLink) {
      console.warn('[handleShare] refLink is empty')
      return
    }

    const shareText = 'Пройди тест и узнай свою внутреннюю опору'

    // 1. Пробуем нативный Web Share API (мобильные браузеры)
    if (navigator.share) {
      console.log('[handleShare] Using navigator.share')
      try {
        await navigator.share({
          title: 'EVA — Тест на искажённые опоры',
          text: shareText,
          url: refLink,
        })
        return
      } catch (err) {
        // Пользователь отменил — не ошибка
        console.log('[handleShare] navigator.share cancelled by user')
        return
      }
    }

    // 2. Пробуем Telegram WebApp
    const tgWebApp = (
      window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
      }
    ).Telegram?.WebApp

    if (tgWebApp?.openTelegramLink) {
      console.log('[handleShare] Using Telegram.WebApp.openTelegramLink')
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(shareText)}`
      tgWebApp.openTelegramLink(shareUrl)
      return
    }

    // 3. Fallback: копируем в буфер + уведомление
    console.log('[handleShare] Fallback: clipboard')
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Clipboard API недоступен — последний resort: alert
      console.log('[handleShare] Clipboard unavailable, showing alert')
      alert(`Ссылка скопирована: ${refLink}`)
    }
  }, [refLink])

  async function submitQualification(finalAnswers: {
    tension_sphere: string
    tension_level: string
    previous_attempts: string
  }) {
    setQualSubmitting(true)
    try {
      const token = localStorage.getItem('eva_token') || ''
      console.log('[submitQualification] payload:', finalAnswers)
      const res = await fetch('/api/qualification/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(finalAnswers),
      })

      const data = await res.json()
      if (data.success) {
        setQualDone(true)
      } else {
        console.error('Qualification failed:', data.error)
        setQualDone(true) // Всё равно показываем успех — пользователь ответил
      }
    } catch (err) {
      console.error('Qualification error:', err)
      setQualDone(true)
    } finally {
      setQualSubmitting(false)
    }
  }

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
          <p className="text-text-primary text-lg font-medium">
            Результат не найден
          </p>
          <p className="text-text-secondary text-sm mt-2">
            Пройдите тест, чтобы увидеть свою доминирующую опору.
          </p>
        </div>
      </main>
    )
  }

  const traitInfo      = getTraitInfo(result.dominantTrait)
  const secTraitInfo   = getTraitInfo(result.secondaryTrait)
  const dominantColor  = TRAIT_COLORS[result.dominantTrait]  ?? 'var(--accent)'
  const secondaryColor = TRAIT_COLORS[result.secondaryTrait] ?? 'var(--text-muted)'
  const isUnlocked     = refCount >= REFERRALS_NEEDED

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary">
      <div className="flex flex-col flex-1 px-5 pt-10 pb-8 max-w-sm mx-auto w-full gap-6">

        {/* ── Заголовок ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center"
        >
          <p className="text-text-muted text-xs uppercase tracking-widest mb-3">
            Ваша доминирующая опора
          </p>
          <h1
            className="text-[28px] font-bold tracking-[-0.02em] leading-tight"
            style={{ color: dominantColor }}
          >
            {traitInfo.title}
          </h1>
          <p className="text-text-secondary text-sm mt-2 leading-relaxed">
            {traitInfo.subtitle}
          </p>
        </motion.div>

        {/* ── WOW: анимированная визуализация шкал ──────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col gap-3 bg-bg-secondary rounded-xl p-5 border border-border"
        >
          <p className="text-text-muted text-xs uppercase tracking-widest text-center mb-1">
            Все 5 шкал
          </p>
          {SCALE_ORDER.map((key, i) => {
            const score = result.scores[key] ?? 0
            const pct = Math.round((score / MAX_SCORE) * 100)
            const isDominant = key === result.dominantTrait
            const color = TRAIT_COLORS[key] ?? 'var(--text-muted)'

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.4 + i * 0.1,
                  ease: 'easeOut',
                }}
                className="flex items-center gap-3"
              >
                <span
                  className={`text-[13px] font-medium w-[120px] text-right flex-shrink-0 ${
                    isDominant ? 'font-semibold' : 'text-text-secondary'
                  }`}
                  style={isDominant ? { color } : undefined}
                >
                  {TRAIT_LABELS[key]}
                </span>
                <div className="flex-1 h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.6,
                      delay: 0.5 + i * 0.1,
                      ease: 'easeOut',
                    }}
                  />
                </div>
                <span className="text-[12px] text-text-muted tabular-nums w-8 flex-shrink-0">
                  {score}
                </span>
              </motion.div>
            )
          })}
        </motion.div>

        {/* ── Описание ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="bg-bg-secondary rounded-xl p-5 border border-border"
        >
          <p className="text-text-primary text-[15px] leading-relaxed">
            {traitInfo.description}
          </p>
        </motion.div>

        {/* ── Вторичная опора (locked / unlocked) ──────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.0 }}
        >
          <AnimatePresence mode="wait">
            {isUnlocked ? (
              <motion.div
                key="unlocked"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="rounded-xl p-5 border bg-bg-secondary"
                style={{ borderColor: secondaryColor }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-text-muted text-xs uppercase tracking-widest">
                    Вторичная опора
                  </p>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: `color-mix(in srgb, ${secondaryColor} 15%, var(--bg-tertiary))`,
                      color: secondaryColor,
                    }}
                  >
                    Открыто
                  </span>
                </div>
                <h2
                  className="text-[20px] font-bold tracking-[-0.02em] mb-2"
                  style={{ color: secondaryColor }}
                >
                  {secTraitInfo.title}
                </h2>
                <p className="text-text-secondary text-[14px] leading-relaxed">
                  {secTraitInfo.subtitle}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="locked"
                className="rounded-xl p-5 border border-border bg-bg-secondary"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-text-muted text-xs uppercase tracking-widest">
                    Вторичная опора
                  </p>
                  <span className="text-[11px] bg-accent-light text-accent px-2 py-0.5 rounded-full font-medium">
                    {refCount}/{REFERRALS_NEEDED} друга
                  </span>
                </div>

                {/* Progress bar */}
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
                  , чтобы увидеть вторичную опору —{' '}
                  <span className="font-semibold tracking-widest text-text-muted">???</span>.
                </p>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.1 }}
                  onClick={handleShare}
                  className="w-full py-3 rounded-xl font-semibold text-[15px] text-white select-none"
                  style={{ background: 'var(--accent)' }}
                >
                  {copied ? 'Ссылка скопирована!' : 'Пригласить друзей'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Квалификация: 3 вопроса ──────────────────────────── */}
        <AnimatePresence mode="wait">
          {!showQualification && !qualDone && (
            <motion.div
              key="qual-cta"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <button
                type="button"
                className="w-full py-4 bg-accent text-white rounded-xl font-semibold text-base active:scale-[0.97] transition-transform duration-150 select-none"
                onClick={() => setShowQualification(true)}
              >
                Ответить на 3 вопроса
              </button>
              <p className="text-center text-[11px] text-text-muted mt-2">
                Это поможет определить, что для вас важно прямо сейчас
              </p>
            </motion.div>
          )}

          {showQualification && !qualDone && (
            <motion.div
              key="qual-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-bg-secondary rounded-xl p-5 border border-border"
            >
              {/* Progress */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-text-muted">
                  Вопрос {qualStep + 1} из 3
                </span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-6 h-1 rounded-full transition-colors ${
                        i <= qualStep ? 'bg-accent' : 'bg-bg-tertiary'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Question */}
              {qualStep === 0 && (
                <div>
                  <p className="text-[17px] font-medium text-text-primary mb-4">
                    Какая сфера вызывает наибольшее напряжение прямо сейчас?
                  </p>
                  <div className="flex flex-col gap-2">
                    {QUAL_SPHERES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                        onClick={() => handleQualAnswer(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {qualStep === 1 && (
                <div>
                  <p className="text-[17px] font-medium text-text-primary mb-4">
                    Как бы вы описали уровень напряжения?
                  </p>
                  <div className="flex flex-col gap-2">
                    {QUAL_LEVELS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                        onClick={() => handleQualAnswer(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {qualStep === 2 && (
                <div>
                  <p className="text-[17px] font-medium text-text-primary mb-4">
                    Вы уже пытались что-то изменить?
                  </p>
                  <div className="flex flex-col gap-2">
                    {QUAL_ATTEMPTS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="w-full py-3 px-4 bg-bg-primary border border-border rounded-xl text-text-primary text-[15px] active:border-accent active:text-accent transition-colors select-none"
                        onClick={() => handleQualAnswer(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {qualDone && (
            <motion.div
              key="qual-done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-bg-secondary rounded-xl p-5 border text-center"
              style={{ borderColor: 'color-mix(in srgb, var(--success) 40%, var(--border))' }}
            >
              <p className="text-success text-[17px] font-medium mb-1">
                ✓ Спасибо за ответы
              </p>
              <p className="text-text-secondary text-sm">
                Мы свяжемся с вами, чтобы помочь разобраться в ситуации.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {qualSubmitting && (
          <div className="flex justify-center py-4">
            <motion.div
              className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        <div className="flex-1" />
      </div>
    </main>
  )
}
