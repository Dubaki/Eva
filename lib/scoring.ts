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
  perfection: 'U',
  pleasing: 'P',
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
    scoreU: totals['perfection'],
    scoreP: totals['pleasing'],
    scoreR: totals['control'],
    scoreK: totals['hyper-vigilance'],
    dominantTrait: SCALE_LETTER[dominant],
    secondaryTrait: SCALE_LETTER[secondary],
    answers,
  }
}

/** Описание опоры для отображения на странице результата */
const TRAIT_DESCRIPTIONS: Record<string, { title: string; subtitle: string; description: string }> = {
  S: {
    title: 'ГЕРОИЧЕСКАЯ ОПОРА',
    subtitle: '',
    description:
      `Ты та, кто держит.\n` +
      `Даже когда тяжело. Даже когда уже нет сил.\n` +
      `Ты не позволяешь себе развалиться.\n` +
      `Не просишь помощи.\n` +
      `Собираешься и идёшь дальше.\n\n` +
      `Но внутри:\n` +
      `— постоянное напряжение\n` +
      `— одиночество\n` +
      `— ощущение, что всё на тебе\n\n` +
      `Ты привыкла быть сильной.\n` +
      `Настолько, что уже не знаешь, как по-другому.\n\n` +
      `Цена:\n` +
      `Ты живёшь на износе.\n` +
      `И даже не разрешаешь себе это признать.\n\n` +
      `⚡️ Внутри звучит:\n` +
      `«Если я перестану держать — меня не станет»`,
  },
  U: {
    title: 'ПОДСТРАИВАЮЩАЯСЯ ОПОРА',
    subtitle: '',
    description:
      `Ты умеешь быть удобной.\n` +
      `Чувствовать других. Подстраиваться.\n` +
      `Ты сглаживаешь углы.\n` +
      `Избегаешь конфликтов.\n` +
      `Часто выбираешь не себя.\n\n` +
      `Но внутри:\n` +
      `— подавленные желания\n` +
      `— злость, которую нельзя проявить\n` +
      `— страх быть отвергнутой\n\n` +
      `Ты стараешься быть хорошей.\n` +
      `Но это не даёт тебе того, что ты хочешь.\n\n` +
      `Цена:\n` +
      `Ты теряешь себя, чтобы сохранить отношения.\n\n` +
      `⚡️ Внутри звучит:\n` +
      `«Если я буду собой — меня не выберут»`,
  },
  P: {
    title: 'ПЕРФЕКЦИОНИРУЮЩАЯ ОПОРА',
    subtitle: '',
    description:
      `Ты живёшь через результат.\n` +
      `Через «сделать правильно»\n` +
      `Ты стараешься быть идеальной.\n` +
      `Не ошибаться.\n` +
      `Держать уровень.\n\n` +
      `Но внутри:\n` +
      `— страх критики\n` +
      `— напряжение\n` +
      `— ощущение, что ты недостаточно хороша\n\n` +
      `Ты всё время доказываешь свою ценность.\n` +
      `Даже когда уже доказала.\n\n` +
      `Цена:\n` +
      `Ты не можешь расслабиться.\n` +
      `Потому что всегда есть «ещё лучше».\n\n` +
      `⚡️ Внутри звучит:\n` +
      `«Если я не идеальна — я ничто»`,
  },
  R: {
    title: 'УДЕРЖИВАЮЩАЯ ОПОРА',
    subtitle: '',
    description:
      `Ты чувствуешь всё.\n` +
      `Атмосферу, людей, напряжение.\n` +
      `Ты сглаживаешь конфликты.\n` +
      `Поддерживаешь.\n` +
      `Держишь «поле».\n\n` +
      `Но внутри:\n` +
      `— перегруз\n` +
      `— тревожность\n` +
      `— ощущение, что слишком много на тебе\n\n` +
      `Ты живёшь через других.\n` +
      `И почти не остаётся места для себя.\n\n` +
      `Цена:\n` +
      `Ты выгораешь, удерживая то, что не обязана держать.\n\n` +
      `⚡️ Внутри звучит:\n` +
      `«Если я отпущу — всё развалится»`,
  },
  K: {
    title: 'КОНТРОЛИРУЮЩАЯ ОПОРА',
    subtitle: '',
    description:
      `Ты стараешься всё предусмотреть.\n` +
      `Держать под контролем.\n` +
      `Ты анализируешь, планируешь, просчитываешь.\n` +
      `Не любишь неопределённость.\n\n` +
      `Но внутри:\n` +
      `— тревога\n` +
      `— напряжение\n` +
      `— ощущение угрозы\n\n` +
      `Ты не расслабляешься.\n` +
      `Потому что «вдруг что-то пойдёт не так».\n\n` +
      `Цена:\n` +
      `Ты живёшь в постоянной готовности к опасности.\n\n` +
      `⚡️ Внутри звучит:\n` +
      `«Если я не контролирую — я в опасности»`,
  },
}

export function getTraitInfo(trait: string): { title: string; subtitle: string; description: string } {
  return TRAIT_DESCRIPTIONS[trait] ?? {
    title: 'Не определено',
    subtitle: '',
    description: 'Не удалось определить доминирующую опору. Попробуйте пройти тест заново.',
  }
}
