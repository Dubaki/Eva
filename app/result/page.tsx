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
  RS: 'R+S — Опора для всех',
  KS: 'K+S — Железная система',
  PU: 'P+U — Идеальная для всех',
  RU: 'R+U — Спасатель',
  KU: 'K+U — Тревожный угодник',
  PR: 'P+R — Социальный идеал',
  KP: 'K+P — Тревожный достигатор',
  KR: 'K+R — Сканер угроз',
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

// Survey questions for soft path
const SURVEY_Q1 = ['Деньги', 'Отношения', 'Здоровье', 'Другое', 'Везде']
const SURVEY_Q2 = ['Сильно мешает', 'Пока терпимо', 'Фоново']
const SURVEY_Q3 = ['Да, многое', 'Немного', 'Нет']

type FunnelStep =
  | 'result'
  | 'surprise-response-yes'
  | 'surprise-response-no'
  | 'hook'                    // "Хочешь увидеть вторую..." Да/Не сегодня
  | 'cooldown-message'        // "Сейчас нет смысла..."
  | 'fast-path'               // Вариант 1 (Пробой) + Вариант 2 (рефералка)
  | 'soft-path-survey'         // Анкета
  | 'soft-path-offer'          // Оффер с двумя кнопками
  | 'soft-path-gift'           // Забрать подарок
  | 'referral-link'            // Показать реферальную ссылку

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

  // ── Hook answer (Да!!! / Не сегодня) ─────────────────────────────────
  const handleHookAnswer = useCallback((wantSecond: boolean) => {
    if (wantSecond) {
      setFunnelStep('fast-path')
    } else {
      setFunnelStep('cooldown-message')
    }
  }, [])

  // ── Cooldown screen buttons ──────────────────────────────────────────
  const handleCooldownButton = useCallback((goFast: boolean) => {
    if (goFast) {
      setFunnelStep('fast-path')
    } else {
      setFunnelStep('soft-path-survey')
    }
  }, [])

  // ── Survey ───────────────────────────────────────────────────────────
  const handleSurveyAnswer = useCallback((value: string) => {
    const next = [...surveyAnswers, value]
    setSurveyAnswers(next)
    if (surveyStep < 2) {
      setSurveyStep(surveyStep + 1)
    } else {
      setFunnelStep('soft-path-offer')
    }
  }, [surveyAnswers, surveyStep])

  // ── Open Telegram DM ─────────────────────────────────────────────────
  const openTelegramDM = useCallback((prefill: string) => {
    const tgWebApp = (window as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
    }).Telegram?.WebApp

    const dmUrl = `https://t.me/${AUTHOR_USERNAME}${prefill ? `?text=${encodeURIComponent(prefill)}` : ''}`

    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(dmUrl)
    } else {
      window.open(dmUrl, '_blank')
    }
  }, [])

  // ── Referral link ────────────────────────────────────────────────────
  const handleShowReferralLink = useCallback(async () => {
    const link = userTgId
      ? `https://t.me/sprosievubot?start=ref_${userTgId}`
      : 'https://t.me/sprosievubot'
    setRefLink(link)

    // Cheat code: trigger mixed trait send to user's Telegram
    const token = localStorage.getItem('eva_token')
    if (token) {
      fetch('/api/test/debug-mixed-trait', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => console.error('[debug-mixed-trait] Error:', err))
    }

    setFunnelStep('referral-link')
  }, [userTgId])

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

    // Compute mixed trait from result scores
    const mixedKey = result ? getMixedTraitKey(result.scores) : ''
    const mixedTraitName = MIXED_TRAIT_NAMES[mixedKey] || 'Не определено'

    // Fire-and-forget: notify author
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

    // Immediately open Telegram DM (don't wait for fetch)
    openTelegramDM('Пробой')
  }, [result, openTelegramDM])

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
                Это нормально. Более того — это и есть часть механизма. Искажённая опора устроена так, что ты не видишь её напрямую. И именно по этому снова и снова оказываешься в одних и тех же ситуациях.
              </p>
              <p className="text-text-secondary text-[14px] leading-relaxed mb-5 whitespace-pre-wrap">
                Базовая опора — это только часть картины. Есть ещё смешанные конфигурации, которые активируются в стрессе.{' '}
                <b>Хочешь увидеть свою вторую искаженную опору?</b>
              </p>
              <div className="flex gap-3">
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: 'var(--accent)' }}
                  onClick={() => handleHookAnswer(true)}>
                  Да!!!
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => handleHookAnswer(false)}>
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
                  onClick={() => handleHookAnswer(true)}>
                  Да!!!
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => handleHookAnswer(false)}>
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
              Сейчас нет смысла проходить тест повторно. У тебя есть 2 месяца что бы демонтировать доминирующую опору. Через 2 месяца ты сможешь пройти тест и увидеть динамику.
            </p>
            <div className="flex flex-col gap-3">
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => handleCooldownButton(true)}>
                Узнать 2 опору сейчас
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

        {/* ════════════ FAST PATH (В работу / Рефералка) ════════════ */}
        {funnelStep === 'fast-path' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-5"
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">
              Я обычно открываю этот слой только тем, кто идёт в работу. Потому что важно не просто увидеть, а понять, как это устроено и что с этим делать.
              {'\n\n'}Есть два варианта, как получить доступ:
            </p>

            {/* Вариант 1 — Пробой */}
            <div className="bg-bg-secondary rounded-xl p-5 border border-border">
              <p className="text-accent text-[13px] font-semibold uppercase tracking-widest mb-2">Вариант 1:</p>
              <p className="text-text-primary text-[14px] leading-relaxed whitespace-pre-wrap mb-4">
                В группе «Пробой» мы:
                — разбираем все конфигурации
                — показываем, как это работает
                — демонтируем искаженную опору
                — выстраиваем новый паттерн

                Это позволяет перестать воспроизводить одну и ту же проблему снова и снова.
              </p>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={handleProboyClick}>
                Хочу в Пробой
              </motion.button>
            </div>

            {/* Вариант 2 — Открыть через участие */}
            <div className="bg-bg-secondary rounded-xl p-5 border border-border">
              <p className="text-accent text-[13px] font-semibold uppercase tracking-widest mb-2">Вариант 2:</p>
              <p className="text-text-secondary text-[14px] leading-relaxed whitespace-pre-wrap mb-4">
                Ты можешь получить разбор своей второй опоры, если пригласишь 2 человек в бота и они подпишутся на канал. Я даю этот доступ в обмен на расширение проекта.
              </p>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] border"
                style={{ background: 'transparent', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onClick={handleShowReferralLink}>
                Получить ссылку
              </motion.button>
            </div>
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
              Вот твоя персональная ссылка:
            </p>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
              <p className="text-accent text-[13px] break-all select-all">{refLink}</p>
            </div>
            <p className="text-text-secondary text-[14px] leading-relaxed mb-4">
              Когда 2 человека перейдут по ней и подпишутся, я открою тебе второй слой.
            </p>
            <div className="flex flex-col gap-3">
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={handleCopyLink}>
                {copied ? 'Ссылка скопирована! ✓' : '📋 Копировать ссылку'}
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-[14px] text-text-muted border border-border"
                onClick={() => {
                  const tgWebApp = (window as unknown as { Telegram?: { WebApp?: { close?: () => void } } }).Telegram?.WebApp
                  if (tgWebApp?.close) {
                    tgWebApp.close()
                  }
                }}>
                Закрыть приложение
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ════════════ SOFT PATH — SURVEY ════════════ */}
        {funnelStep === 'soft-path-survey' && surveyStep < 3 && (
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

        {/* ════════════ SOFT PATH — OFFER ════════════ */}
        {funnelStep === 'soft-path-offer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-6">
              Есть 2 способа работы с искаженной опорой:

              ✓ Жёсткий, но быстрый — это группа «Пробой»
              ✓ Мягкий и постепенный — это «Пирамида Потенциала» или персональная работа

              Какой способ тебе ближе?
            </p>
            <div className="flex flex-col gap-3">
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => openTelegramDM('Пробой')}>
                Жёсткий быстрый
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-semibold text-[15px] border"
                style={{ background: 'transparent', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onClick={() => openTelegramDM('Пирамида')}>
                Мягкий постепенный
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-[14px] text-text-muted"
                onClick={() => setFunnelStep('soft-path-gift')}>
                Пока не готова
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ════════════ SOFT PATH — GIFT ════════════ */}
        {funnelStep === 'soft-path-gift' && (
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
            <p className="text-text-secondary text-[14px] leading-relaxed whitespace-pre-wrap mb-4">
              Я ценю, что ты была искренней. В подарок дарю тебе практику по твоей напряжённой сфере. Ты можешь начать изменения уже сегодня.
            </p>
            <motion.button type="button" whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
              style={{ background: 'var(--accent)' }}
              onClick={() => openTelegramDM('Хочу забрать подарок')}>
              🎁 Забрать подарок
            </motion.button>
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
