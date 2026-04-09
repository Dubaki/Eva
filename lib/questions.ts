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
  // === performance (S — Самоценность) ===
  { id: 1, text: 'Мне трудно показывать уязвимость', scale: 'performance' },
  { id: 2, text: 'Я беру на себя больше ответственности, чем нужно', scale: 'performance' },
  { id: 3, text: 'Если я расслаблюсь, всё может развалиться', scale: 'performance' },
  { id: 4, text: 'Я редко прошу о помощи', scale: 'performance' },
  { id: 5, text: 'Я чувствую, что должна держать уровень, определённую планку', scale: 'performance' },

  // === perfection (U — Перфекционизм) ===
  { id: 6, text: 'Мне сложно вступать в открытый конфликт', scale: 'perfection' },
  { id: 7, text: 'Я чаще подстраиваюсь, чем настаиваю', scale: 'perfection' },
  { id: 8, text: 'Я переживаю, если кто-то мной недоволен', scale: 'perfection' },
  { id: 9, text: 'Мне легче уступить, чем выдерживать напряжение', scale: 'perfection' },
  { id: 10, text: 'Я боюсь выглядеть сложной и некомфортной', scale: 'perfection' },

  // === pleasing (P — Угодничество) ===
  { id: 11, text: 'Ошибки сильно влияют на мою самооценку', scale: 'pleasing' },
  { id: 12, text: 'Мне важно выглядеть компетентной', scale: 'pleasing' },
  { id: 13, text: 'Критика выбивает меня сильнее, чем я это показываю', scale: 'pleasing' },
  { id: 14, text: 'Я не люблю показывать сомнения', scale: 'pleasing' },
  { id: 15, text: 'Результат влияет на моё ощущение ценности', scale: 'pleasing' },

  // === control (R — Контроль) ===
  { id: 16, text: 'Я чувствую атмосферу и напряжение раньше других', scale: 'control' },
  { id: 17, text: 'Мне сложно оставаться спокойной, если вокруг конфликт', scale: 'control' },
  { id: 18, text: 'Я бессознательно сглаживаю, чтобы стало "нормально"', scale: 'control' },
  { id: 19, text: 'Моё состояние зависит от настроения других', scale: 'control' },
  { id: 20, text: 'Я чаще думаю, как всем, чем как мне', scale: 'control' },

  // === hyper-vigilance (K — Сверхбдительность) ===
  { id: 21, text: 'Мне трудно отпустить ситуацию', scale: 'hyper-vigilance' },
  { id: 22, text: 'Я продумываю возможные риски заранее', scale: 'hyper-vigilance' },
  { id: 23, text: 'Когда что-то идёт не по плану, я тревожусь', scale: 'hyper-vigilance' },
  { id: 24, text: 'Я предпочитаю держать процесс под контролем', scale: 'hyper-vigilance' },
  { id: 25, text: 'Мне сложно доверять, если нет ясности', scale: 'hyper-vigilance' },
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
