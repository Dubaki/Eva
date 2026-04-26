# ЗАДАНИЕ: Полное восстановление приложения EVA

> **Этот документ — твоё единственное задание.** Читай его полностью, не пропускай разделы. Если по какому-то моменту возникнет неоднозначность — **остановись и спроси меня (пользователя)**, не угадывай.

---

## 0. Контекст

В репозитории есть Next.js 14 + Supabase приложение «EVA» (Telegram Mini App). За последние месяцы в коде накопились расхождения с целевой логикой и дизайном. Нужно **системно привести код в соответствие** с тремя источниками истины:

1. **`LOGIC.md`** (в корне проекта) — полная логика всех страниц, сообщений бота, БД, переходов. **Главный источник правды по поведению.**
2. **`TEXTS.md`** (в корне проекта) — все тексты слово-в-слово. **Главный источник правды по формулировкам.**
3. **`design_reference.html`** (в корне проекта) — приложенный мной HTML-файл с эталонным дизайном всех страниц. **Главный источник правды по визуалу.**

Эти три файла — закон.

Дополнительно в репозитории лежат:

- **`LOCAL_DEV.md`** — инструкция по локальному запуску, ngrok, ручному тестированию по 9 сценариям. После каждого этапа сверяйся с этими сценариями — это твой инструмент приёмки.
- **`DEPLOYMENT.md`** — инструкция по деплою на Vercel и настройке Supabase. Самостоятельно ничего на проде не трогай — деплой делает пользователь, твоя задача только подготовить код. Если в коде ты найдёшь что-то, что им противоречит — приоритет всегда у этих документов.

Твоя задача — **не переписать всё с нуля**, а **аккуратно отредактировать существующий код**, чтобы он соответствовал этим трём документам. Существующая кодовая база содержит много правильной логики (RPC-функции, JWT-аутентификация, Telegram webhook валидация, скоринг теста, тексты опор) — её нужно сохранить.

---

## 1. Жёсткие правила работы

### 1.1. Никакой самодеятельности

- **Не придумывай тексты.** Все формулировки — только из `TEXTS.md`. Если в `TEXTS.md` нет текста для какого-то места — спроси меня.
- **Не придумывай логику.** Все условия переходов, таймеры, защиты от дублей — только из `LOGIC.md`. Если в `LOGIC.md` нет однозначного описания какого-то edge-case — спроси меня.
- **Не придумывай дизайн.** Цвета, шрифты, отступы, скругления, тени, анимации — только как в `design_reference.html`. Если для какой-то страницы дизайна нет — спроси.

### 1.2. Не ломай то, что работает

В коде уже есть рабочие куски. **Не трогай их без необходимости:**

- `lib/scoring.ts` — алгоритм скоринга, не менять.
- `lib/questions.ts` — 25 вопросов, не менять.
- `lib/jwt.ts`, HMAC-валидация в `app/api/auth/route.ts` — не менять.
- `lib/randomize.ts` — генератор случайного порядка вопросов, не менять.
- Существующие миграции (001, 002, …, 106) — **не редактировать**. Любые изменения структуры БД — только новой миграцией с номером 107+.
- Логику работы админки (`app/admin/page.tsx` и `app/api/admin/*`) — функционал не менять, **только дизайн**.
- Дебаг-инструмент получения `file_id` от админов в webhook бота — не трогать.
- RPC `submit_test_result_v2` — оставить, только добавить вставку `cooldown_reminder` в очередь (см. п. 4.3).

### 1.3. Сохраняй типобезопасность

- Никаких `any` без явной необходимости.
- Все ответы API типизировать через interface/type.
- `lib/supabase/types.ts` обновить под актуальную схему БД (смотри `LOGIC.md` п. 1).

### 1.4. После каждого крупного изменения — линт + тип-чек

```bash
npm run lint
npx tsc --noEmit
```

Не должно быть ни одной ошибки. Если линт ругается — чини сразу, не накапливай.

### 1.5. Что не делать

- **Не делай рефакторинг ради рефакторинга.** Если файл работает корректно по `LOGIC.md` — не переписывай его.
- **Не добавляй новые библиотеки** без согласования. В проекте уже есть Tailwind, Framer Motion, @twa-dev/sdk — этого достаточно.
- **Не лезь в `node_modules` и `.next`.**
- **Не пуши в гит** без моего разрешения.

---

## 2. Порядок работы (этапы)

Делай этапы строго по очереди. Каждый этап завершается коротким репортом «что сделано» и **остановкой для подтверждения**, если в этапе появились решения, не описанные в `LOGIC.md`/`TEXTS.md`/дизайне.

### Этап 1 — Аудит и подготовка
### Этап 2 — Миграции БД и типы
### Этап 3 — Backend (API + Edge Functions + Webhook)
### Этап 4 — Frontend (страницы + компоненты + дизайн-токены)
### Этап 5 — Финальная проверка

Подробности по каждому этапу — ниже.

---

## 3. Этап 1 — Аудит и подготовка

### 3.1. Прочитай три источника истины

```
LOGIC.md            (полностью)
TEXTS.md            (полностью)
design_reference.html (полностью, все 8 страниц)
```

### 3.2. Прочитай кодовую базу

Минимум эти файлы — потому что они содержат рабочую логику, которую надо сохранить:

```
package.json
tailwind.config.ts
middleware.ts
app/layout.tsx
app/page.tsx
app/test/page.tsx
app/result/page.tsx
app/api/auth/route.ts
app/api/user/status/route.ts
app/api/test/submit/route.ts
app/api/test/results/route.ts
app/api/share/route.ts
app/api/subscription/confirm/route.ts
app/api/webhook/telegram/route.ts
app/api/admin/login/route.ts
components/Gatekeeper.tsx
components/AdminEntrance.tsx
components/results/*.tsx
lib/scoring.ts
lib/questions.ts
lib/constants/results.ts
lib/telegram.ts
lib/telegram-bot.ts
lib/supabase/types.ts
supabase/functions/process-bot-queue/index.ts
supabase/functions/process-bot-notifications/index.ts
supabase/functions/send-periodic-reminders/index.ts
supabase/migrations/106_*.sql
```

### 3.3. Подготовь конфиг дизайн-токенов

Из `design_reference.html` (любая из страниц — у них одинаковый `tailwind.config`) скопируй блок `tailwind.config.extend` и **полностью замени им** содержимое `tailwind.config.ts`.

Должны попасть:
- все цвета (`primary`, `primary-container`, `surface`, `surface-container`, `outline`, `secondary`, …) — это Material Design 3 dark scheme.
- borderRadius (`DEFAULT: 0.25rem`, `lg: 0.5rem`, `xl: 0.75rem`, `full: 9999px`).
- spacing (`xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`, `gutter: 12px`, `container-padding: 20px`, `unit: 4px`).
- fontFamily (Newsreader для headline, Manrope для body/label).
- fontSize (`headline-xl: 40px`, `headline-lg: 32px`, `headline-md: 24px`, `body-lg: 18px`, `body-md: 16px`, `body-sm: 14px`, `label-md: 12px`, `label-sm: 10px`).

В `app/layout.tsx` должно быть:
- подключение шрифтов Newsreader + Manrope через `next/font/google` (предпочтительно) или через `<link>` к Google Fonts.
- подключение Material Symbols Outlined (для иконок типа `spa`, `lock`, `arrow_back` — точно как в дизайне).
- `<html className="dark">` — фиксируем тёмную тему.
- `<body className="bg-background text-on-surface font-body-md ...">`.

### 3.4. Создай переиспользуемый хедер

В `design_reference.html` каждая страница содержит идентичный хедер:

```html
<header class="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 shadow-... sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full">
  <div class="flex items-center gap-3">
    <span class="material-symbols-outlined text-[#8BA88E]">spa</span>
    <h1 class="font-['Newsreader'] italic text-xl text-[#8BA88E]">EvaTest</h1>
  </div>
  <button class="text-slate-400 ..."><span class="material-symbols-outlined">more_vert</span></button>
</header>
```

Создай `components/EvaHeader.tsx` (декоративный, без логики). Используй его на **всех 8 страницах**.

### 3.5. Создай glass-card утилиту

Стиль `.glass-card` повторяется на всех страницах:

```css
.glass-card {
  background: rgba(48, 53, 61, 0.4);  /* или 27, 32, 39, 0.6 на части страниц */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(194, 200, 192, 0.1);
}
```

Добавь в `app/globals.css` (создай если нет) или сделай React-компонент `<GlassCard>`. Бери оттенок прозрачности из дизайна целевой страницы — они слегка отличаются.

### 3.6. Создай файл `lib/constants/texts.ts`

Все строки из `TEXTS.md` вынеси в один TS-файл с константами. Структура:

```ts
export const TEXTS = {
  gatekeeper: {
    title: 'Доступ ограничен',
    subtitle: 'Подпишись на мой канал. ...',
    btnSubscribe: '📢 Подписаться',
    btnConfirm: '✅ Я подписалась',
    footer: 'Как только подпишешься — откроется доступ ко всему функционалу теста',
    errorNotSubscribed: 'Подписка не найдена. Пожалуйста, подпишитесь на канал и попробуйте снова.',
  },
  start: { ... },
  test: { ... },
  result: { ... },
  access: { ... },
  referral: { ... },
  mechanism: { ... },
  cooldown: { ... },
  bot: {
    welcome: { caption: '...', btnSubscribe: '...', btnConfirm: '...' },
    subscriptionConfirmed: { caption: '...', btnTest: '...' },
    referralLinkPart1: '...',
    referralLinkPart2: '...',  // с подстановкой ${tgId}
    referralFailed: 'Вижу, твои друзья ещё не прошли тест. Попробуем им напомнить?',
    cooldownEnded: { text: '...', btnTest: '✨ Пройти тест' },
    quizIntro1: '...',
    quizIntro2: '...',
    quizQ1: { text: '...', options: [{label, value, callback}, ...] },
    quizQ2: { ... },
    quizQ3: { ... },
    quizFinal: { text: '...', options: [...] },
    quizGiftStub: '🎁 Твой подарок готов!',
    anyMessage: (firstName?: string) => firstName ? `Рада видеть тебя снова, ${firstName}!` : 'Рада видеть тебя снова!',
    afterFinalHard: 'Отлично! Нажми кнопку ниже — я жду твоего сообщения:',
    testButtonNotSubscribed: { text: '🔒 ...', btnSubscribe: '...', btnConfirm: '...' },
    testButtonSubscribed: { text: '🌿 Нажми кнопку, чтобы открыть тест:', btnTest: '▶️ Пройти тест' },
    startReturning: { text: 'Рада видеть тебя снова! Твой тест ждёт тебя.', btnTest: 'Пройти тест' },
  },
  result_S: '...',  // Героическая опора, длинный текст
  result_U: '...',  // Подстраивающаяся
  result_P: '...',  // Перфекционирующая
  result_R: '...',  // Удерживающая
  result_K: '...',  // Контролирующая
  mixed: {
    SU: '...',
    PS: '...',
    RS: '...',
    KS: '...',
    PU: '...',
    RU: '...',
    KU: '...',
    PR: '...',
    KP: '...',
    KR: '...',
  },
};
```

Все тексты — слово-в-слово как в `TEXTS.md`. Проверь буквально каждую запятую.

После создания этого файла **удали** старые места, где тексты захардкожены:
- `lib/constants/results.ts` — заменить на реэкспорт из `texts.ts` (для обратной совместимости можно оставить старый интерфейс, но строки тянуть из нового источника).
- Тексты в `lib/telegram.ts` (`MIXED_TRAIT_TEXTS`) — переехали в `TEXTS.mixed`.
- Тексты в JSX компонентов и edge-функций — заменить на ссылки на `TEXTS.*`.

---

## 4. Этап 2 — Миграции БД и типы

### 4.1. Миграция `107_add_mixed_trait_sent_flag.sql`

```sql
-- Migration 107: защита от двойной отправки сообщения «Вторая опора»
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mixed_trait_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mixed_trait_sent_at TIMESTAMPTZ DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
```

### 4.2. Миграция `108_extend_submit_test_rpc_with_cooldown.sql`

Расширить RPC `submit_test_result_v2` так, чтобы при сохранении результата:
- помимо текущей логики (test_results upsert, profiles update, реферал) **дополнительно вставлять задачу** в `bot_tasks_queue` с `event_type = 'cooldown_reminder'` и `run_at = NOW() + INTERVAL '60 days'`.
- но **только если** для этого профиля ещё нет такой pending-задачи (`WHERE NOT EXISTS (SELECT 1 FROM bot_tasks_queue WHERE profile_id = p_profile_id AND event_type = 'cooldown_reminder' AND status = 'pending')`).

Также при сохранении результата **сбрасывать** `profiles.reminded_at = NULL` и `profiles.mixed_trait_sent = FALSE` — пользователь начинает новый цикл.

### 4.3. Обнови `lib/supabase/types.ts`

Под актуальную схему БД (по `LOGIC.md` п. 1). Особенно:
- добавить поля `mixed_trait_sent`, `mixed_trait_sent_at` в `profiles`.
- проверить, что `qualifications` имеет поля `current_tension_sphere`, `tension_severity`, `previous_experience` (а не старые `tension_sphere`/`tension_level`/`previous_attempts`).
- `bot_tasks_queue` имеет поля как в LOGIC.md.

### 4.4. Применение миграций

**Не применяй миграции автоматически.** Просто положи файлы в `supabase/migrations/` и в финальном репорте этапа 2 укажи: «Миграции 107 и 108 готовы, применить вручную через Supabase SQL Editor или CI».

---

## 5. Этап 3 — Backend

### 5.1. API роуты — что делаем по каждому

| Файл | Действие |
|---|---|
| `app/api/auth/route.ts` | **Не трогать.** Работает корректно. |
| `app/api/user/status/route.ts` | **Переделать:** при каждом вызове делать `getChatMember(channelId, tgId)` к Telegram. По результату обновлять `profiles.is_subscribed` и возвращать актуальное значение. Возвращать `{isSubscribed, lastTestDate, cooldownDays}`. |
| `app/api/subscription/confirm/route.ts` | Использовать `process.env.NEXT_PUBLIC_APP_URL` вместо хардкода `eva-9udm.vercel.app`. Текст из `TEXTS.bot.subscriptionConfirmed`. Слать сообщение **только если** `wasAlreadySubscribed === false`. Создать хелпер `lib/get-app-url.ts` с функцией `getAppUrl()`, которая возвращает `NEXT_PUBLIC_APP_URL` || `https://${VERCEL_URL}` || `http://localhost:3000`. Использовать его везде, где нужен публичный URL. |
| `app/api/test/progress/route.ts` | **Не трогать**, только проверить, что схема ответа совпадает с тем, что ждёт `app/test/page.tsx`. |
| `app/api/test/submit/route.ts` | Оставить вызов RPC. Удалить старую вставку `start_qualification` (она теперь в RPC, см. ниже). |
| `app/api/test/results/route.ts` | **Исправить контракт ответа:** возвращать `{dominantTrait, secondaryTrait}` (а не `primarySupport`/`secondarySupport`). Внутри читать колонки `primary_support`/`secondary_support`. Это критический баг — без этого результат не загружается на клиенте. |
| `app/api/qualification/submit/route.ts` | **Удалить файл.** Анкета полностью в боте. |
| `app/api/share/route.ts` | Тексты из `TEXTS.bot.referralLinkPart1` и `TEXTS.bot.referralLinkPart2`. Логика: проверить `shared_at`. Если NULL — отправить 2 сообщения, поставить `shared_at = NOW()`, **вставить задачу `check_referral_12h` в `bot_tasks_queue` на +12 часов**. Если уже не NULL — вернуть `{success: true, alreadyShared: true}` без отправки. |
| `app/api/user/share-clicked/route.ts` | **Удалить файл** (дубликат `/api/share`). |
| `app/api/user/contact-author/route.ts` | Оставить, проверить актуальность типов. |
| `app/api/notify-author/route.ts` | Если не используется — удалить. Если используется — оставить. |
| `app/api/admin/login/route.ts` | Поменять дефолтное значение PIN с `2026` на `0999` (на случай отсутствия env). И в комментарии написать: «PIN управляется через env-переменную ADMIN_PIN». |
| `app/api/admin/*` | **Не трогать функционал.** |
| `app/api/webhook/telegram/route.ts` | Большая чистка — см. п. 5.2. |
| `app/api/bot/setup/route.ts` | Проверить, что устанавливает корректные команды и MenuButton (`🌿 Тест` → web_app). |
| `app/api/bot/send-gift-message/route.ts` | **Удалить файл.** Старая нерабочая логика. |
| `app/api/gift-link/route.ts` | Оставить (используется в админке). |
| `app/api/referrals/route.ts` | Проверить актуальность. |
| `app/api/referrals/apply/route.ts` | Проверить, не дублируется ли с RPC. Если функционал уже в RPC — удалить. |

### 5.2. Webhook бота (`app/api/webhook/telegram/route.ts`)

Полностью пересобрать обработчик согласно `LOGIC.md` п. 4 и `TEXTS.md` секция II:

**Команды:**
- `/start [<ref?>]`:
  - Парсить `start=ref_<tgId>` из payload, сохранять в `profiles.referred_by`.
  - Создавать/обновлять профиль (UPSERT по `tg_id`).
  - Если профиль новый или ещё не подписан → отправлять сообщение №1 «Старт» (`TEXTS.bot.welcome`) с картинкой `start.png` и двумя кнопками.
  - Если профиль уже есть и подписан → отправлять `TEXTS.bot.startReturning` + кнопка `Пройти тест` (web_app).
- `/test`:
  - Если подписан → `TEXTS.bot.testButtonSubscribed` + кнопка web_app.
  - Если не подписан → `TEXTS.bot.testButtonNotSubscribed`.

**Callback `check_sub`:**
- Делать `getChatMember`. Если статус `member`/`administrator`/`creator`:
  - `is_subscribed = true`. Если **раньше было false** — отправить сообщение №2 `TEXTS.bot.subscriptionConfirmed` (картинка `start1.png`).
  - Toast: «Спасибо за подписку! 🎉».
- Иначе — alert: «Ты всё ещё не подписана 😔». Профиль не менять.

**Callback анкеты `quiz_q1_*` / `q2_*` / `q3_*`:**
- Сохранять в `qualifications` (UPSERT по `profile_id`).
- Обновлять `profiles.bot_quiz_step`.
- Шаги: `q1` → `bot_quiz_step = 2`, шлём вопрос 2; `q2` → `bot_quiz_step = 3`, шлём вопрос 3; `q3` → `bot_quiz_step = 4`, шлём финальное сообщение, **ставим в очередь задачу `send_gift` на +60 секунд**.
- Перед обработкой проверять `bot_quiz_step`. Если ответ пришёл на «не тот» вопрос (например, q1 при шаге 2) — игнорировать с alert: «Ответ уже сохранён».
- После обработки **убирать клавиатуру** через `editMessageReplyMarkup(chatId, messageId, {inline_keyboard: []})`.

**Callback финала `quiz_final_*`:**
- `quiz_final_hard` → служебное сообщение `TEXTS.bot.afterFinalHard` с кнопкой URL `https://t.me/evapatrakhina?text=Пробой!`. Поставить `bot_quiz_step = 5`, `contact_author_clicked = true`.
- `quiz_final_soft` → то же, но URL `https://t.me/evapatrakhina?text=Пирамида%20Потенциала`.
- `quiz_final_not_ready` → только `bot_quiz_step = 5`. Без сообщения.

> **Важно:** удалить старую отправку «Благодарю за честность…» — её больше нет.

**Любой текст (не команда, не callback, не от админа-видео):**
- Шлём `TEXTS.bot.anyMessage(first_name)` + кнопка URL `Написать Еве` → `https://t.me/evapatrakhina`.

**Видео от `evapatrakhina` или `bizbezit`:**
- Дебаг-инструмент: ответить `✅ FILE ID:\n<code>{file_id}</code>`. **Не трогать.**

### 5.3. Edge Function `process-bot-queue`

Полностью переделать согласно `LOGIC.md` п. 4 (типы задач) и `TEXTS.md`:

```ts
// Псевдокод
for (task of pending_tasks_with_run_at_lte_now) {
  switch (task.event_type) {
    case 'start_qualification':
      if (profile.bot_quiz_step >= 1) { mark_processed; break; }
      sendMessage(TEXTS.bot.quizIntro1);
      sendMessage(TEXTS.bot.quizIntro2);
      sendMessage(TEXTS.bot.quizQ1.text, {keyboard: TEXTS.bot.quizQ1.options});
      profile.bot_quiz_step = 1;
      mark_processed;
      break;

    case 'send_gift':
      if (process.env.GIFT_VIDEO_FILE_ID) {
        sendVideo({video: GIFT_VIDEO_FILE_ID, protect_content: true});
      } else {
        sendMessage(TEXTS.bot.quizGiftStub); // заглушка
      }
      mark_processed;
      break;

    case 'check_referral_12h':
      // если invites_count >= 2 и mixed_trait_sent === false:
      //   отправить смешанную опору, mixed_trait_sent = true.
      // если invites_count < 2:
      //   отправить TEXTS.bot.referralFailed.
      mark_processed;
      break;

    case 'cooldown_reminder':
      if (profile.reminded_at) { mark_processed; break; }
      sendMessage(TEXTS.bot.cooldownEnded.text, {keyboard: [[TEXTS.bot.cooldownEnded.btnTest -> web_app]]});
      profile.reminded_at = NOW();
      mark_processed;
      break;
  }
}
```

Дополнительно: **дебаг-инструмент перехвата видео от админов** (как сейчас — оставить).

### 5.4. Edge Function `process-bot-notifications`

Триггерится Supabase webhook на INSERT/UPDATE `test_results`. Что делает:

- При INSERT: отправить в чат-бот сообщение №3 «Твоя опора» (картинка опоры + текст из `TEXTS.result_X`).
- При UPDATE: отправить только если `primary_support` изменился.
- Дополнительно: при UPDATE `profiles.invites_count` (нужен отдельный webhook/trigger, либо проверка в этой же функции по-другому): если `invites_count >= 2 && mixed_trait_sent === false` → отправить смешанную опору, поставить `mixed_trait_sent = true`. Это **дублирующий** путь к сообщению №6 — для случая, когда 2 реферала набрались **после** истечения 12-часовой задачи.

### 5.5. Edge Function `send-periodic-reminders`

Оставить как fallback. Текст обновить на `TEXTS.bot.cooldownEnded`.

### 5.6. RPC `submit_test_result_v2`

Через миграцию 108 (см. п. 4.2) расширить:
1. Добавить вставку `cooldown_reminder` в очередь.
2. Сбросить `reminded_at = NULL` и `mixed_trait_sent = FALSE`.
3. Сохранить вставку `start_qualification` (24 часа), если её ещё не было в RPC — добавить.

---

## 6. Этап 4 — Frontend

### 6.1. Структура страниц

После реорганизации в `app/` должны быть:

```
app/
  layout.tsx              ← шрифты + Material Symbols + темная тема
  page.tsx                ← Стартовая (3.1) + Gatekeeper-обвязка
  test/page.tsx           ← Тест (3.2)
  result/page.tsx         ← Результат (3.3)
  access/page.tsx         ← Доступ (3.4) НОВАЯ
  referral/page.tsx       ← Реферальная ссылка (3.5) НОВАЯ
  mechanism/page.tsx      ← Механизм (3.6) НОВАЯ
  cooldown/page.tsx       ← Кулдаун (3.7) НОВАЯ
  admin/page.tsx          ← Админка (только дизайн)
  api/...                 ← без изменений по структуре
```

> Альтернативно: Доступ/Реферальная/Механизм можно сделать как роуты внутри `/result/...` если так проще навигация. **Уточни у пользователя**, если выберешь альтернативу.

### 6.2. По каждой странице

Для каждой — открой соответствующий раздел в `design_reference.html`, скопируй структуру, цвета, классы Tailwind. Адаптируй под React/JSX.

#### `app/page.tsx` (Стартовая, раздел 3.1)
- `<EvaHeader />`.
- Длинный нарративный текст (3 части) с цитатным форматированием (italic, primary accent).
- Декоративная картинка-разделитель (можно убрать `googleusercontent.com` URL и поставить градиент или твою картинку).
- Две плашки 25 вопросов / 5–7 минут.
- Блок «Инструкция».
- Sticky кнопка `Начать тест` внизу (как в дизайне — `fixed bottom-0`).
- **Логика-обвязка:** `Gatekeeper` обернёт всё, см. ниже.

#### `app/test/page.tsx` (Тест, раздел 3.2)
- Кастомный мини-хедер с кнопкой `←` слева и счётчиком `3/25` справа (вместо `<EvaHeader>` или вместе с ним — смотри дизайн).
- Полоса прогресса под хедером (ширина = `(currentIndex+1)/25 * 100%`).
- Большой текст вопроса по центру.
- Две кнопки `Да` / `Нет` высотой ~96px.
- При завершении: оверлей «Сейчас посчитаю.\nЭто не совсем то, что ты думаешь.» **минимум 2.5 секунды** (даже если API ответил быстрее).
- **Удалить** текст «Осмысляю…».
- Логика прогресса (PATCH `/api/test/progress`) — оставить.

#### `app/result/page.tsx` (Результат, раздел 3.3)
- `<EvaHeader />`.
- Hero-секция: картинка опоры (`/hero.png` для S, и т. д. — см. таблицу в `LOGIC.md` п. 3.3) с overlay-градиентом, плашка `РЕЗУЛЬТАТ ТЕСТА`, заголовок `Ваша доминирующая опора: [Название]`.
- Glass-card с длинным текстом из `TEXTS.result_X`.
- Блок «Удивил ли тебя результат?» с двумя кнопками `Да`/`Нет`.

> **Удалить:** компонент `ConfirmModal.tsx` и все его использования. Никаких подтверждений нет.

- После клика `Да`/`Нет` — задержка 1 сек (мягкий fade-in), потом появляется новый блок с инсайт-текстом (`TEXTS.result.insightYes` или `insightNo`) с вертикальной линией слева. Скролл к блоку (`scrollIntoView({behavior: 'smooth'})`).
- Под инсайт-блоком сразу показывается следующий блок: «Хочешь увидеть свою вторую искажённую опору?» с кнопками `Да` (→ `/access`) и `Не уверена` (→ `/mechanism`).

> **Исправить контракт данных:** API теперь возвращает `dominantTrait`/`secondaryTrait` (см. п. 5.1). Клиент читает эти поля. Букву из `dominantTrait` мапит в название и картинку.

#### `app/access/page.tsx` (Доступ, раздел 3.4) — НОВАЯ
- `<EvaHeader />`.
- Декоративная иллюстрация-сфера (по дизайну `Result Screen` блок «Доступ ко второй опоре»).
- Цитата `TEXTS.access.quote`.
- Текст `TEXTS.access.body`.
- Кнопка `Получить ссылку` → `router.push('/referral')`.

#### `app/referral/page.tsx` (Реферальная, раздел 3.5) — НОВАЯ
- `<EvaHeader />`.
- Декоративная картинка-символ.
- Подзаголовок «Вот твоя персональная ссылка:».
- Поле со ссылкой `https://t.me/sprosievubot?start=ref_<tgId>` + иконка `content_copy` (на клик копирует).
- Текст под полем `TEXTS.referral.body`.
- Кнопка `Поделиться`:
  - Шлёт `POST /api/share` с `{tgId, link}`.
  - При успехе — `Telegram.WebApp.close()`.
  - При повторном нажатии (если `alreadyShared: true`) — просто закрыть webapp.

#### `app/mechanism/page.tsx` (Механизм, раздел 3.6) — НОВАЯ
- `<EvaHeader />`.
- Декоративный пульсирующий круг с иконкой (по дизайну).
- Заголовок `Время для действий`.
- Цитата `TEXTS.mechanism.quote`.
- Текст `TEXTS.mechanism.body`.
- Две кнопки:
  - `Узнать вторую опору сейчас` → `router.push('/access')`.
  - `Узнаю через 2 месяца` → `Telegram.WebApp.close()`.

#### `app/cooldown/page.tsx` (Кулдаун, раздел 3.7) — НОВАЯ
- `<EvaHeader />`.
- Декоративная анимация (песочные часы / пульс).
- Заголовок `Время для действий`.
- Цитата `TEXTS.cooldown.quote`.
- Glass-card с текстом «Тест будет доступен снова через **N** дней». N приходит из API. Plural rules: 1 → «1 день», 2-4 → «N дня», 5+ → «N дней».
- Кнопка `Написать Еве`:
  - Сначала `POST /api/user/contact-author`.
  - Потом `Telegram.WebApp.openTelegramLink('https://t.me/evapatrakhina')`.

#### `app/admin/page.tsx`
- **Не трогать функционал.**
- Применить общую дизайн-систему: шрифты, цвета, glass-card, хедер. Все формы и таблицы — в стиле dark Material 3.

### 6.3. Компонент `Gatekeeper`

Перепиши под новую логику:

```ts
useEffect(() => {
  // 1. вызвать /api/auth для получения JWT
  // 2. вызвать /api/user/status?tg_id=... — получить {isSubscribed, lastTestDate, cooldownDays}
  // 3.
  if (!isSubscribed) {
    show <SubscriptionGate />;  // дизайн страницы 3.0 «Доступ закрыт»
  } else if (cooldownDays > 0) {
    router.replace('/cooldown');
  } else {
    // ничего, рендерим children (стартовую страницу)
  }
}, []);
```

Страница «Доступ закрыт» — встроенный экран в `Gatekeeper`, не отдельный route. По дизайну — карточка glass-card с иконкой замка.

### 6.4. Компоненты для удаления

- `components/ConfirmModal.tsx` — удалить файл и все import-ы.
- `components/results/CooldownScreen.tsx` — удалить, кулдаун теперь отдельная страница.
- Возможно `app/loading/page.tsx` — проверь, используется ли. Если нет — удалить.

### 6.5. Интеграция Telegram WebApp SDK

В `Gatekeeper` или в `layout.tsx`:

```ts
import WebApp from '@twa-dev/sdk';
useEffect(() => {
  WebApp.ready();
  WebApp.expand();
  WebApp.setHeaderColor('#0f141a');  // под наш дизайн
  WebApp.setBackgroundColor('#0f141a');
}, []);
```

### 6.6. Material Symbols

Использовать через `<span class="material-symbols-outlined">spa</span>`. Чтобы заполнялись правильно (`FILL: 0/1`), задавать через CSS variable `font-variation-settings`:

```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1;
}
```

В дизайне используются: `spa`, `lock`, `arrow_back`, `more_vert`, `quiz`, `schedule`, `play_arrow`, `chat_bubble`, `content_copy`, `share`, `info`, `stars`, `hourglass_empty`, `calendar_today`, `settings_accessibility`, `open_in_new`, `arrow_forward`, `auto_stories`, `psychology`, `person`, `help_outline`, `settings`.

---

## 7. Этап 5 — Финальная проверка

### 7.1. Чек-лист

Прогони весь чек-лист из `LOGIC.md` п. 9. Каждый пункт — либо ✅ сделано, либо ⏸ требует ручного действия (типа применения миграции или установки env).

### 7.2. Тип-чек и линт

```bash
npm run lint && npx tsc --noEmit
```

Не должно быть ошибок и предупреждений.

### 7.3. Сборка

```bash
npm run build
```

Должна пройти без ошибок.

### 7.4. Финальный репорт

Сделай файл `RESTORATION_REPORT.md` в корне с разделами:
- **Что сделано:** список всех изменённых файлов с короткими описаниями.
- **Что удалено:** список удалённых файлов.
- **Что добавлено:** список новых файлов.
- **Что нужно сделать вручную:** применить миграции 107/108, добавить `ADMIN_PIN=0999`, `GIFT_VIDEO_FILE_ID=<когда получим>`, обновить webhook бота (`/api/bot/setup`), задеплоить edge-функции.
- **Открытые вопросы:** если в процессе нашлись неоднозначности — список. Не решай их сам, выписывай для меня.

---

## 8. Памятка по форматам и стилям

### Анимации (Framer Motion)

- Появление блоков на «Результат» после ответа `Да/Нет` → `motion.div` с `initial={{opacity: 0, y: 10}}`, `animate={{opacity: 1, y: 0}}`, `transition={{duration: 0.4}}`.
- Спиннер на оверлее теста → CSS-анимация или `motion.div` с `rotate: 360`, `transition: {repeat: Infinity, duration: 1, ease: 'linear'}`.
- Пульсирующий круг на «Кулдаун» / «Механизм» → как в дизайне (`animate-pulse` Tailwind).

### Кнопки

- Primary (filled, акцент): `bg-primary-container text-on-primary-container rounded-xl`. На hover/active: `active:scale-[0.97]`.
- Secondary (outlined): `border border-secondary text-secondary rounded-xl`.
- Tertiary (text only): `text-outline rounded-xl`.

### Размеры

- Высота основных кнопок ~56px.
- Высота кнопок ответа теста ~96px (большие квадраты).
- Padding страниц: `px-container-padding` (=20px) + `py-xl` (=32px).
- Радиус glass-card: `rounded-xl` (=12px).

### Скругление и тени

- Все карточки: `rounded-xl` (12px) или `rounded-lg` (8px) для второстепенных.
- Тени: `shadow-lg`, `shadow-xl`, `shadow-[0_4px_20px_rgba(0,0,0,0.15)]`.
- Кнопка-floating: `shadow-lg` + `shadow-primary/10`.

---

## 9. Что делать в неоднозначных ситуациях

**Стоп-список вопросов** — на эти случаи не догадывайся, **спрашивай меня**:

1. В коде встретился API endpoint, не упомянутый в `LOGIC.md`. Нужен ли он? — спросить.
2. В коде есть таблица БД, не упомянутая в `LOGIC.md` (например, старые `referrals` или `app_settings`). Используется ли? — спросить.
3. Дизайн страницы X в `design_reference.html` отсутствует / неполный. — спросить.
4. Какая-то новая функция (например, история прохождений) — нет в `LOGIC.md`. — спросить.
5. Возникла техническая проблема с подключением (env переменная, домен, ключи) — спросить.
6. Если миграции 107/108 нужно как-то обкатать на продовой БД с минимальным риском — спросить.

**Что НЕ требует вопроса:**
- Любое уточнение Tailwind-классов (бери прямо из дизайна).
- Любые имена React-компонентов и хелперов (выбирай по смыслу).
- Любые внутренние имена переменных, типы, экспорты.

---

## 10. Финальный артефакт

После всех 5 этапов в репозитории должно быть:

- `LOGIC.md`, `TEXTS.md`, `design_reference.html`, `LOCAL_DEV.md`, `DEPLOYMENT.md` — без изменений.
- `tailwind.config.ts` — обновлён под дизайн-токены.
- `app/layout.tsx` — со шрифтами и тёмной темой.
- 8 страниц webapp работают, все переходы — как в `LOGIC.md` п. 6.
- Webhook бота отвечает на все триггеры из `TEXTS.md` секция II.
- 4 типа задач в `bot_tasks_queue` корректно обрабатываются edge-функцией.
- Подписка перепроверяется при каждом открытии webapp.
- `mixed_trait_sent` защищает от двойной отправки сообщения №6.
- `npm run build && npm run lint && npx tsc --noEmit` — чисто.
- `RESTORATION_REPORT.md` — отчёт.
- Все 9 сценариев из `LOCAL_DEV.md` проходят на локальном стенде с ngrok.

---

> Если что-то непонятно — спрашивай. Лучше задать 5 уточняющих вопросов, чем сделать одно неправильное предположение. Удачи.
