import { QUESTIONS, type Scale } from './questions'

export type Answer = { questionId: number; score: number }

export type ScoreResult = {
  scoreS: number
  scoreU: number
  scoreP: number
  scoreR: number
  scoreK: number
  dominantTrait: string
  secondaryTrait: string
  answers: Answer[]
}

/** Приоритет шкал при равенстве баллов (на основе имен картинок) */
const SCALE_PRIORITY: Scale[] = [
  'hero',
  'perfectionist',
  'pleaser',
  'stayer',
  'controller',
]

/** Маппинг Scale → буква шкалы (как в БД) */
const SCALE_LETTER: Record<Scale, string> = {
  hero: 'S',
  perfectionist: 'P',
  pleaser: 'U',
  stayer: 'R',
  controller: 'K',
}

/**
 * Рассчитывает баллы по 5 шкалам на основе массива ответов.
 *
 * Алгоритм:
 * - Для каждой шкалы суммируем баллы ответов (1-5) по её вопросам.
 * - Максимум на шкалу: 5 вопросов × 5 баллов = 25.
 * - Доминантная опора = шкала с максимальным суммарным баллом.
 * - Вторичная опора = шкала со вторым по величине баллом.
 * - При равенстве: приоритет определяется порядком SCALE_PRIORITY.
 */
export function calculateScores(answers: Answer[]): ScoreResult {
  const totals: Record<Scale, number> = {
    hero: 0,
    perfectionist: 0,
    pleaser: 0,
    stayer: 0,
    controller: 0,
  }

  // Суммируем баллы по шкалам
  for (const answer of answers) {
    const question = QUESTIONS.find((q) => q.id === answer.questionId)
    if (!question) continue
    totals[question.scale] += answer.score
  }

  // Формируем ранжированный список шкал
  const ranked = SCALE_PRIORITY.slice().sort((a, b) => {
    const diff = totals[b] - totals[a]
    if (diff !== 0) return diff
    // При равенстве — приоритет по порядку в SCALE_PRIORITY
    return SCALE_PRIORITY.indexOf(a) - SCALE_PRIORITY.indexOf(b)
  })

  const dominant = ranked[0]
  const secondary = ranked[1]

  return {
    scoreS: totals['hero'],
    scoreP: totals['perfectionist'],
    scoreU: totals['pleaser'],
    scoreR: totals['stayer'],
    scoreK: totals['controller'],
    dominantTrait: SCALE_LETTER[dominant],
    secondaryTrait: SCALE_LETTER[secondary],
    answers,
  }
}
