export type Scale =
  | 'hero'
  | 'perfectionist'
  | 'pleaser'
  | 'stayer'
  | 'controller'

export interface Question {
  id: number
  text: string
  scale: Scale
}

export const QUESTIONS: Question[] = [
  // === hero (S — Героическая) ===
  { id: 1, text: 'Мне трудно показывать уязвимость', scale: 'hero' },
  { id: 2, text: 'Я беру на себя больше ответственности, чем нужно', scale: 'hero' },
  { id: 3, text: 'Если я расслаблюсь, всё может развалиться', scale: 'hero' },
  { id: 4, text: 'Я редко прошу о помощи', scale: 'hero' },
  { id: 5, text: 'Я чувствую, что должна держать уровень, определённую планку', scale: 'hero' },

  // === pleaser (U — Подстраивающаяся) ===
  { id: 6, text: 'Мне сложно вступать в открытый конфликт', scale: 'pleaser' },
  { id: 7, text: 'Я чаще подстраиваюсь, чем настаиваю', scale: 'pleaser' },
  { id: 8, text: 'Я переживаю, если кто-то мной недоволен', scale: 'pleaser' },
  { id: 9, text: 'Мне легче уступить, чем выдерживать напряжение', scale: 'pleaser' },
  { id: 10, text: 'Я боюсь выглядеть сложной и некомфортной', scale: 'pleaser' },

  // === perfectionist (P — Перфекционирующая) ===
  { id: 11, text: 'Ошибки сильно влияют на мою самооценку', scale: 'perfectionist' },
  { id: 12, text: 'Мне важно выглядеть компетентной', scale: 'perfectionist' },
  { id: 13, text: 'Критика выбивает меня сильнее, чем я это показываю', scale: 'perfectionist' },
  { id: 14, text: 'Я не люблю показывать сомнения', scale: 'perfectionist' },
  { id: 15, text: 'Результат влияет на моё ощущение ценности', scale: 'perfectionist' },

  // === stayer (R — Удерживающая) ===
  { id: 16, text: 'Я чувствую атмосферу и напряжение раньше других', scale: 'stayer' },
  { id: 17, text: 'Мне сложно оставаться спокойной, если вокруг конфликт', scale: 'stayer' },
  { id: 18, text: 'Я бессознательно сглаживаю, чтобы стало "нормально"', scale: 'stayer' },
  { id: 19, text: 'Моё состояние зависит от настроения других', scale: 'stayer' },
  { id: 20, text: "Я чаще думаю 'как всем?', чем 'как мне?'", scale: 'stayer' },

  // === controller (K — Контролирующая) ===
  { id: 21, text: 'Мне трудно отпустить ситуацию', scale: 'controller' },
  { id: 22, text: 'Я продумываю возможные риски заранее', scale: 'controller' },
  { id: 23, text: 'Когда что-то идёт не по плану, я тревожусь', scale: 'controller' },
  { id: 24, text: 'Я предпочитаю держать процесс под контролем', scale: 'controller' },
  { id: 25, text: 'Мне сложно доверять, если нет ясности', scale: 'controller' },
]

const SCALE_SHORT_MAP: Record<Scale, string> = {
  hero: 'S',
  perfectionist: 'P',
  pleaser: 'U',
  stayer: 'R',
  controller: 'K',
}

export function getQuestionById(id: number): Question | undefined {
  return QUESTIONS.find((q) => q.id === id)
}

export function getScaleShort(scale: Scale): string {
  return SCALE_SHORT_MAP[scale]
}
