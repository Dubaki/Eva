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
    title: 'Самоценность',
    subtitle: 'Опора на «Я недостаточно хорош(а)»',
    description:
      'Ваша доминирующая опора связана с ощущением собственной ценности. ' +
      'В сложных ситуациях вы склонны сомневаться в себе, обесценивать свои достижения ' +
      'и сравнивать себя с другими. Это не слабость — это механизм, который когда-то помог вам выжить. ' +
      'Но сейчас он может мешать вам расти и принимать свои успехи.',
  },
  U: {
    title: 'Перфекционизм',
    subtitle: 'Опора на «Всё или ничего»',
    description:
      'Ваша доминирующая опора — стремление к идеалу. ' +
      'Вы не соглашаетесь на меньшее, и это admirable. Но внутренний критник не даёт вам покоя, ' +
      'и ошибка для вас — это не опыт, а доказательство несостоятельности. ' +
      'Эта опора держит вас в напряжении и не позволяет наслаждаться достигнутым.',
  },
  P: {
    title: 'Угодничество',
    subtitle: 'Опора на «Я должен быть удобным»',
    description:
      'Ваша доминирующая опора — забота о других в ущерб себе. ' +
      'Вам сложно сказать «нет», вы подстраиваетесь под настроение окружающих ' +
      'и жертвуете своими потребностями. Это делает вас чутким человеком, ' +
      'но иногда вы теряете себя ради того, чтобы другие были довольны.',
  },
  R: {
    title: 'Контроль',
    subtitle: 'Опора на «Всё должно быть под контролем»',
    description:
      'Ваша доминирующая опора — контроль. ' +
      'Неопределённость вызывает у вас тревогу, и вы планируете всё заранее. ' +
      'Вам трудно доверять другим — проще сделать самому. ' +
      'Эта опора даёт ощущение безопасности, но лишает свободы и спонтанности.',
  },
  K: {
    title: 'Сверхбдительность',
    subtitle: 'Опора на «Беда случится в любой момент»',
    description:
      'Ваша доминирующая опора — постоянная готовность к угрозе. ' +
      'Вы сканируете окружение на предмет подвоха, замечаете малейшие изменения в тоне ' +
      'и выражении лица. Даже в безопасной обстановке вы внутренне напряжены. ' +
      'Эта опора когда-то защищала вас, но теперь не даёт расслабиться.',
  },
}

export function getTraitInfo(trait: string): { title: string; subtitle: string; description: string } {
  return TRAIT_DESCRIPTIONS[trait] ?? {
    title: 'Не определено',
    subtitle: '',
    description: 'Не удалось определить доминирующую опору. Попробуйте пройти тест заново.',
  }
}
