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

const RESULT_IMG: Record<string, string> = {
  S: '/result_s.png',
  U: '/result_u.png',
  P: '/result_p.png',
  R: '/result_r.png',
  K: '/result_k.png',
}

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
  const [debugStartParam, setDebugStartParam] = useState<string>('—')

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

    // Fallback: если в sessionStorage нет, пробуем получить с сервера
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

    if (!stored) {
      fetchResult()
    }

    setLoading(false)

    // Read start_param from Telegram WebApp for debug display
    const sp = (window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } }
    }).Telegram?.WebApp?.initDataUnsafe?.start_param
    setDebugStartParam(sp ?? '—')

    // Load tg_id for referral link generation
    const profileRaw = localStorage.getItem('eva_profile')
    if (profileRaw) {
      try {
        const profile = JSON.parse(profileRaw) as StoredProfile
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'sprosievubot'
        const link = profile.tg_id ? `https://t.me/${botUsername}?start=ref_${profile.tg_id}` : ''
        setRefLink(link || `https://t.me/${botUsername}`)
      } catch { /* ignore */ }
    }

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
    // Build referral link: https://t.me/sprosievubot?start=ref_[USER_ID]
    const profileRaw = localStorage.getItem('eva_profile')
    let userId: number | null = null
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as StoredProfile
        userId = p.tg_id
      } catch { /* ignore */ }
    }
    const shareUrl = userId
      ? `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/sprosievubot?start=ref_${userId}`)}&text=${encodeURIComponent('Пройди этот тест и узнай свою внутреннюю опору!')}`
      : `https://t.me/share/url?url=${encodeURIComponent('https://t.me/sprosievubot')}&text=${encodeURIComponent('Пройди этот тест и узнай свою внутреннюю опору!')}`

    // 1. Пробуем нативный Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'EVA — Тест на искажённые опоры',
          text: 'Пройди этот тест и узнай свою внутреннюю опору!',
          url: userId ? `https://t.me/sprosievubot?start=ref_${userId}` : 'https://t.me/sprosievubot',
        })
        return
      } catch {
        // user cancelled — not an error
      }
    }

    // 2. Telegram WebApp
    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
    }).Telegram?.WebApp

    if (tgWebApp?.openTelegramLink) {
      try {
        tgWebApp.openTelegramLink(shareUrl)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
        console.error('[handleShare] openTelegramLink error:', err)
        alert('Ошибка: ' + msg)
      }
      return
    }

    // 3. Fallback: clipboard
    try {
      const link = userId ? `https://t.me/sprosievubot?start=ref_${userId}` : 'https://t.me/sprosievubot'
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      alert('Скопируйте ссылку: https://t.me/sprosievubot')
    }
  }, [])

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
          <p className="text-text-secondary text-sm mt-2 mb-4">
            Пройдите тест, чтобы увидеть свою доминирующую опору.
          </p>
          <a
            href="/test"
            className="inline-block py-3 px-6 bg-accent text-white rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform"
          >
            Пройти тест
          </a>
        </div>
      </main>
    )
  }

  const traitInfo      = getTraitInfo(result.dominantTrait)
  const secTraitInfo   = getTraitInfo(result.secondaryTrait)
  const dominantColor  = 'var(--accent)'
  const secondaryColor = 'var(--text-muted)'
  const isUnlocked     = refCount >= REFERRALS_NEEDED
  const resultImgSrc   = RESULT_IMG[result.dominantTrait] ?? '/hero.png'

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary">
      <div className="flex flex-col flex-1 px-5 pt-10 pb-8 max-w-sm mx-auto w-full gap-6">

        {/* ── Персонализированная картинка результата ─────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden"
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

        {/* ── Заголовок ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
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

        {/* ── Описание ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-bg-secondary rounded-xl p-5 border border-border"
        >
          <p className="text-text-primary text-[15px] leading-relaxed">
            {traitInfo.description}
          </p>
        </motion.div>

        {/* ── Интерактив: Ты узнала? ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="text-center"
        >
          <p className="text-text-primary text-[16px] font-medium mb-3">
            Ты узнала свою искажённую опору?
          </p>
          <div className="flex gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
              style={{ background: 'var(--accent)' }}
              onClick={() => alert('Отлично! Переходим дальше...')}
            >
              Да
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
              style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              onClick={() => alert('Поняла! Расскажу подробнее...')}
            >
              Нет
            </motion.button>
          </div>
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

        {/* debug strip — remove after testing */}
        <p className="text-[10px] text-text-muted text-center pb-2 select-none">
          Start Param: {debugStartParam} | Invites: {refCount}
        </p>
      </div>
    </main>
  )
}
