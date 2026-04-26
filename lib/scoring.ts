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

/** Приоритет шкал при равенстве баллов */
const SCALE_PRIORITY: Scale[] = [
  'performance',
  'perfection',
  'pleasing',
  'control',
  'hyper-vigilance',
]

/** Маппинг Scale → буква шкалы (как в БД) */
const SCALE_LETTER: Record<Scale, string> = {
  performance: 'S',
  perfection: 'P',
  pleasing: 'U',
  control: 'R',
  'hyper-vigilance': 'K',
}

/** Маппинг буквы шкалы → поле в ScoreResult */
const SCORE_FIELD: Record<string, keyof Omit<ScoreResult, 'dominantTrait' | 'secondaryTrait' | 'answers'>> = {
  S: 'scoreS',
  U: 'scoreU',
  P: 'scoreP',
  R: 'scoreR',
  K: 'scoreK',
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
    performance: 0,
    perfection: 0,
    pleasing: 0,
    control: 0,
    'hyper-vigilance': 0,
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
    scoreS: totals['performance'],
    scoreP: totals['perfection'],
    scoreU: totals['pleasing'],
    scoreR: totals['control'],
    scoreK: totals['hyper-vigilance'],
    dominantTrait: SCALE_LETTER[dominant],
    secondaryTrait: SCALE_LETTER[secondary],
    answers,
  }
}