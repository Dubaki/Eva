export type Scale =
  | 'performance'
  | 'perfection'
  | 'pleasing'
  | 'control'
  | 'hyper-vigilance'

export interface Question {
  id: number
  text: string
  scale: Scale
}

export const QUESTIONS: Question[] = [
  // === performance (Самоценность) — 5 вопросов ===
  {
    id: 1,
    text: 'Мне часто кажется, что я недостаточно хорош(а), чего бы я ни достиг(ла).',
    scale: 'performance',
  },
  {
    id: 2,
    text: 'Я склон(на/ен) обесценивать свои успехи, считая их случайностью или везением.',
    scale: 'performance',
  },
  {
    id: 3,
    text: 'Мне трудно принимать комплименты — я чувствую, что их не заслуживаю.',
    scale: 'performance',
  },
  {
    id: 4,
    text: 'Я часто сравниваю себя с другими и прихожу к выводу, что я хуже.',
    scale: 'performance',
  },
  {
    id: 5,
    text: 'Даже когда у меня всё хорошо, я чувствую внутреннюю пустоту или неудовлетворённость.',
    scale: 'performance',
  },

  // === perfection (Перфекционизм) — 5 вопросов ===
  {
    id: 6,
    text: 'Я не могу считать дело сделанным, пока оно не станет идеальным.',
    scale: 'perfection',
  },
  {
    id: 7,
    text: 'Ошибка для меня — это не опыт, а доказательство моей несостоятельности.',
    scale: 'perfection',
  },
  {
    id: 8,
    text: 'Мне проще не начинать дело, если я не уверен(а), что справлюсь с ним безупречно.',
    scale: 'perfection',
  },
  {
    id: 9,
    text: 'Я часто переделываю работу, даже когда другие считают её хорошей.',
    scale: 'perfection',
  },
  {
    id: 10,
    text: 'Внутренний критник не даёт мне расслабиться — всегда есть что улучшить.',
    scale: 'perfection',
  },

  // === pleasing (Угодничество) — 5 вопросов ===
  {
    id: 11,
    text: 'Мне сложно сказать «нет», даже когда просьба идёт вразрез с моими интересами.',
    scale: 'pleasing',
  },
  {
    id: 12,
    text: 'Я часто извиняюсь, даже когда не чувствую за собой вины.',
    scale: 'pleasing',
  },
  {
    id: 13,
    text: 'Я подстраиваюсь под настроение окружающих, чтобы избежать конфликта.',
    scale: 'pleasing',
  },
  {
    id: 14,
    text: 'Мне кажется, что люди полюбят меня, только если я буду удобным(ой).',
    scale: 'pleasing',
  },
  {
    id: 15,
    text: 'Я часто жертвую своими потребностями ради других и потом чувствую обиду.',
    scale: 'pleasing',
  },

  // === control (Контроль) — 5 вопросов ===
  {
    id: 16,
    text: 'Мне трудно доверять другим — проще сделать всё самому.',
    scale: 'control',
  },
  {
    id: 17,
    text: 'Неопределённость вызывает у меня сильную тревогу.',
    scale: 'control',
  },
  {
    id: 18,
    text: 'Я планирую всё заранее, и отклонение от плана выбивает меня из колеи.',
    scale: 'control',
  },
  {
    id: 19,
    text: 'Мне кажется, что если я расслаблю контроль, всё развалится.',
    scale: 'control',
  },
  {
    id: 20,
    text: 'Я часто даю советы и указания, даже когда меня об этом не просят.',
    scale: 'control',
  },

  // === hyper-vigilance (Сверхбдительность) — 5 вопросов ===
  {
    id: 21,
    text: 'Я постоянно сканирую окружение на предмет угрозы или подвоха.',
    scale: 'hyper-vigilance',
  },
  {
    id: 22,
    text: 'Мне трудно расслабиться — я всегда «на стрёме».',
    scale: 'hyper-vigilance',
  },
  {
    id: 23,
    text: 'Я замечаю малейшие изменения в тоне голоса или выражении лица собеседника.',
    scale: 'hyper-vigilance',
  },
  {
    id: 24,
    text: 'Даже в безопасной обстановке я чувствую внутреннее напряжение.',
    scale: 'hyper-vigilance',
  },
  {
    id: 25,
    text: 'Мне кажется, что беда случится в любой момент, и я должен(на) быть готов(а).',
    scale: 'hyper-vigilance',
  },
]

const SCALE_SHORT_MAP: Record<Scale, string> = {
  performance: 'S',
  perfection: 'U',
  pleasing: 'P',
  control: 'R',
  'hyper-vigilance': 'K',
}

export function getQuestionById(id: number): Question | undefined {
  return QUESTIONS.find((q) => q.id === id)
}

export function getScaleShort(scale: Scale): string {
  return SCALE_SHORT_MAP[scale]
}
