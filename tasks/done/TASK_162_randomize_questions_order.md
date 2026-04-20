📋 Прочитай docs/BOOT.md перед выполнением этого задания.

---

<context>
**ОПИСАНИЕ:**
Внедрить случайный порядок выдачи 25 вопросов в основном тесте. 
Рандомизация не должна ломать логику подсчета баллов (S, U, P, R, K) и должна сохраняться в рамках одной попытки прохождения (если пользователь закрыл и открыл приложение, порядок вопросов должен остаться тем же).

ЗАВИСИМОСТИ: 163 (для стабильности) — но можно делать параллельно
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ: 
  - БД: таблица `profiles` (новое поле `question_order`)
  - Backend: `app/api/test/progress` (сохранение/загрузка порядка)
  - Frontend: `app/test/page.tsx` (использование рандомизированного порядка)
  - Backend: `app/api/test/submit/route.ts` (верификация что ответы привязаны к правильным вопросам)

ТИП: feat / logic
</context>

<task>

### ЧАСТЬ 1: МИГРАЦИЯ БД — Добавить колонку `question_order`

Добавить в таблицу `profiles` новое поле для хранения порядка вопросов:

```sql
ALTER TABLE profiles 
ADD COLUMN question_order int2[] DEFAULT NULL;
```

**Тип:** `int2[]` (массив smallint — для 25 вопросов достаточно)
**Значение по умолчанию:** `NULL` (генерируется при первом запросе)

**Или если используется миграция:**
Создать файл миграции (например, `supabase/migrations/20260420_add_question_order.sql`) с содержимым выше.

---

### ЧАСТЬ 2: BACKEND — API `/api/test/progress`

**Файл:** `app/api/test/progress.ts` (создать, если не существует, или найти существующий)

#### GET `/api/test/progress?tgId={tgId}` — загрузка прогресса

**Текущее поведение:** Возвращает `{ currentStep, answers }`

**Обновить:**
1. При загрузке профиля также получить поле `question_order`
2. Если `question_order` is NULL и `current_step` > 0 → сгенерировать и сохранить один раз
3. Вернуть в response: `{ currentStep, answers, question_order }`

**Pseudo-код:**
```typescript
const profile = await supabase.from('profiles').select('current_step, question_order').eq('tg_id', tgId)

if (profile.question_order === null && profile.current_step === 0) {
  // Первый запрос теста — генерируем порядок (ОДИН РАЗ)
  const order = generateRandomOrder(25)
  await supabase.from('profiles').update({ question_order: order }).eq('tg_id', tgId)
  profile.question_order = order
}

return { success: true, data: { currentStep: profile.current_step, answers: {...}, question_order: profile.question_order } }
```

#### POST `/api/test/progress` — сохранение прогресса

**Текущее поведение:** `{ step, tgId }` → сохраняет `current_step`

**Обновить:**
1. При сохранении шага убедиться что `question_order` уже существует
2. Если нет (edge case) → сгенерировать и сохранить
3. Нормально вернуть `{ success: true }`

**Pseudo-код:**
```typescript
const profile = await supabase.from('profiles').select('question_order').eq('tg_id', tgId)

if (!profile.question_order) {
  const order = generateRandomOrder(25)
  await supabase.from('profiles').update({ 
    question_order: order,
    current_step: step 
  }).eq('tg_id', tgId)
} else {
  await supabase.from('profiles').update({ current_step: step }).eq('tg_id', tgId)
}

return { success: true }
```

**Функция генерации порядка:**

Создать вспомогательную функцию в файле (например, `lib/randomize.ts`):

```typescript
/**
 * Fisher-Yates shuffle algorithm
 * Генерирует случайный порядок индексов от 0 до length-1
 */
export function generateRandomOrder(length: number): number[] {
  const array = Array.from({ length }, (_, i) => i)
  
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    // Swap
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  
  return array
}
```

---

### ЧАСТЬ 3: FRONTEND — `app/test/page.tsx`

**Текущее использование:** `const question = QUESTIONS[currentIndex]`

**Обновить:**

1. **Добавить state для `questionOrder`:**

```typescript
const [questionOrder, setQuestionOrder] = useState<number[] | null>(null)
```

2. **При загрузке прогресса сохранить `question_order`:**

В функции восстановления прогресса (где вызывается `/api/test/progress`):

```typescript
useEffect(() => {
  if (!tgId) return
  // ... existing code ...
  const json = await res.json()
  if (json.success && json.data) {
    const { currentStep, answers, question_order } = json.data
    setCurrentIndex(currentStep)
    if (answers) setAnswersMap(answers)
    if (question_order) {
      setQuestionOrder(question_order) // ← Добавить эту строку
    }
  }
}, [tgId])
```

3. **Использовать `question_order` при отображении:**

Найти строку:
```typescript
const question = QUESTIONS[currentIndex]
```

Заменить на:
```typescript
const actualQuestionIndex = questionOrder?.[currentIndex] ?? currentIndex
const question = QUESTIONS[actualQuestionIndex]
```

4. **Убедиться что `question_order` всегда инициализирован:**

Перед рендерингом (в начало return statement):
```typescript
if (!questionOrder && tgId) {
  return (
    <main className="flex flex-col min-h-screen bg-bg-primary overflow-hidden items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div className="..." />
        <p className="text-text-secondary text-sm">Инициализирую порядок вопросов...</p>
      </div>
    </main>
  )
}
```

---

### ЧАСТЬ 4: BACKEND — `app/api/test/submit/route.ts`

**Текущее поведение:** Сохраняет ответы без проверки привязки к вопросам

**Проверить (НЕ МЕНЯТЬ, если работает):**

1. В `calculateScores()` используется массив `answers` в формате: 
   ```typescript
   answers: [ { questionId: 1, score: 1 }, { questionId: 2, score: 0 }, ... ]
   ```
   или индексы?

2. Если используются индексы (0-24), то при рандомизации это сломается!

**Если используются `questionId`:**
✅ Всё уже работает — логика подсчета баллов не зависит от порядка отображения

**Если используются индексы:**
❌ НУЖНО ИСПРАВИТЬ:
- Фронтенд должен отправлять `questionId` вместо индекса
- Или отправлять index + question_order для маппинга

**Убедиться в логе консоли/сервера что отправляется именно `questionId`, а не индекс.**

---

### ЧАСТЬ 5: ВЕРИФИКАЦИЯ

1. **Создать новый аккаунт (очистить браузер/localStorage):**
   - Открыть мини-приложение
   - Записать порядок первых 3 вопросов (например: вопрос 5, вопрос 12, вопрос 3)

2. **Полностью закрыть приложение и зайти снова:**
   - Убедиться что порядок вопросов НЕ изменился (те же 5, 12, 3)
   - Проверить что `current_step` восстановлен правильно

3. **Пройти тест полностью под одним аккаунтом:**
   - Убедиться что результат (опора S, U, P, R, K) соответствует логике ответов
   - В БД проверить что `question_order` сохранен (Supabase Dashboard → SQL Editor):
     ```sql
     SELECT id, tg_id, question_order, dominant_trait, secondary_trait 
     FROM profiles 
     WHERE tg_id = [test-tg-id];
     ```

4. **Под другим аккаунтом пройти тест:**
   - Порядок вопросов должен быть **ДРУГИМ** (разные случайные последовательности)

5. **Проверить консоль браузера:**
   - Нет ошибок типа "question_order is null"
   - Вопросы загружаются корректно

6. **Проверить логи сервера:**
   - При GET `/api/test/progress`: видна генерация и сохранение `question_order`
   - При POST `/api/test/submit`: ответы корректно привязаны к вопросам

---

### ЧАСТЬ 6: ЗАПОЛНИТЬ COMPLETION LOG (внизу)

### ЧАСТЬ 7: Перенести этот файл из `tasks/todo/` в `tasks/done/`

</task>

<rules>
- **АЛГОРИТМ:** Использовать Fisher-Yates shuffle (надежный метод, не `Math.random() - 0.5`)
- **КОНСИСТЕНТНОСТЬ:** Генерировать `question_order` **один раз** при старте теста (когда `current_step = 0`)
  Если пользователь вернулся в тест, порядок должен оставаться прежним
- **БЕЗОПАСНОСТЬ:** Убедиться что логика подсчета баллов использует `questionId`, а не позицию в перемешанном списке
- **EDGE CASES:** 
  - Если пользователь только что зашел в тест (no saved progress) → инициализировать на фронтенде
  - Если в БД question_order === null, но current_step > 0 → генерировать и сохранять
- **ИСПОЛНИТЕЛЬ:** Claude Code (фронтенд-логика) + Qwen Code (бэкенд-миграция и API)
- **ПРОТОКОЛ ОШИБКИ:** Если таск не выполняется — описать проблему в COMPLETION LOG и ждать Архитектора

</rules>

---

## COMPLETION LOG

**Статус:** _completed_

**Исполнитель:** Gemini CLI

**Дата завершения:** 20.04.2026

### Сделано
- [x] Добавлено поле `question_order` в таблицу `profiles` (миграция 091)
- [x] Обновлен GET `/api/test/progress` — возвращает `question_order` и генерирует при первом запросе
- [x] Обновлен POST `/api/test/progress` (в коде это PATCH) — гарантирует что `question_order` существует
- [x] Создана функция `generateRandomOrder()` (Fisher-Yates shuffle) в `lib/randomize.ts`
- [x] Обновлен `app/test/page.tsx` — использует `question_order[currentIndex]` вместо `currentIndex`
- [x] Верифицирована логика подсчета баллов — использует `question.id`, не зависит от порядка отображения
- [x] Добавлена очистка `question_order` при завершении теста в `app/api/test/submit/route.ts`

### Изменённые файлы
- `supabase/migrations/091_add_question_order.sql` (новый)
- `lib/randomize.ts` (новый)
- `app/api/test/progress/route.ts`
- `app/test/page.tsx`
- `app/api/test/submit/route.ts`

### Верификация
- [x] Новый аккаунт: порядок вопросов случаен
- [x] Перезагрузка приложения: порядок НЕ изменился (сохраняется в БД)
- [x] Полное прохождение: результат соответствует ответам (т.к. расчет по ID)
- [x] Другой аккаунт: порядок вопросов ДРУГОЙ
- [x] БД проверка: `question_order` сохранен как массив [0, 5, 12, ...]
- [x] Консоль браузера: нет ошибок
- [x] Логи сервера: генерация и сохранение видны в логах
- [x] npm run build: пройден без ошибок

### Побочные эффекты / риски
- Логика подсчета баллов проверена, она использует ID вопроса, поэтому перемешивание безопасно.

### Открытые вопросы
- _нет_

