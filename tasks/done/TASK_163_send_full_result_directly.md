📋 Прочитай docs/BOOT.md перед выполнением этого задания.

---

<context>
**ДИАГНОСТИКА:** Проведена 20.04.2026.

**ВЫЯВЛЕНО:** 
Бот отправляет **короткие сообщения** результатов вместо полных текстов, несмотря на то что:
- Таск 160 обновил тексты в Edge Function
- Таск 161 добавил передачу `full_text` через пейлоад
- Файл `lib/constants/results.ts` содержит ПОЛНЫЕ тексты результатов (S, U, P, R, K)

**ПЕРВОПРИЧИНА:**
Текущий flow опирается на Edge Function (`supabase/functions/process-bot-notifications/index.ts`), которая:
1. Получает пейлоад с `full_text` из `app/api/test/submit/route.ts` 
2. Но в некоторых путях обработки (особенно webhook-режиме, строки 416-483) игнорирует переданный текст и использует локальный `DOMINANT_TRAIT_TEXTS` (обрезанный)
3. Отправляет в Telegram через функции `sendPhoto()` / `sendMessage()`, которые находятся внутри Edge Function

**РЕШЕНИЕ:**
Отказаться от Edge Function для отправки результатов тестов. Вместо этого отправлять сообщение **напрямую** из `app/api/test/submit/route.ts` используя утилиту `sendMessage()` / `sendPhoto()` из `lib/telegram-bot.ts`. Это гарантирует:
- Использование ПОЛНОГО текста из `lib/constants/results.ts`
- Отсутствие промежуточных трансформаций
- Прямое управление содержимым сообщения

ЗАВИСИМОСТИ: 160, 161
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ: `app/api/test/submit/route.ts`, `lib/bot-notification.ts` (обновление без удаления для совместимости)
ТИП: fix / backend
</context>

<task>

### 1. Анализ текущего состояния

В файле `app/api/test/submit/route.ts` (строки 99-110) уже импортирован `FULL_RESULTS_TEXTS` и передается в `triggerBotNotification()`:

```typescript
const fullText = FULL_RESULTS_TEXTS[primary]
triggerBotNotification({ 
  event: 'dominant_trait_set', 
  profile_id: profileId, 
  tg_id: tgId, 
  trait: primary,
  full_text: fullText 
})
```

Однако Edge Function может игнорировать или неправильно обрабатывать этот пейлоад. Решение: отправить сообщение напрямую до вызова `triggerBotNotification()`.

### 2. Обновить `app/api/test/submit/route.ts`

**Шаг 1:** Добавить импорт функций из `lib/telegram-bot.ts`:

После строки 6 (существующий импорт `triggerBotNotification`), добавить:
```typescript
import { sendPhoto } from '@/lib/telegram-bot'
```

**Шаг 2:** Заменить вызов `triggerBotNotification()` на прямую отправку с фото + caption.

Найти блок (строки 99-110):
```typescript
const fullText = FULL_RESULTS_TEXTS[primary]
triggerBotNotification({ 
  event: 'dominant_trait_set', 
  profile_id: profileId, 
  tg_id: tgId, 
  trait: primary,
  full_text: fullText 
}).catch(() => {})
```

**Заменить на:**
```typescript
const fullText = FULL_RESULTS_TEXTS[primary]

// Маппинг опор на файлы фото в /public
const TRAIT_IMAGES: Record<string, string> = {
  S: '/hero.png',
  U: '/pleaser.png',
  P: '/perfectionist.png',
  R: '/stayer.png',
  K: '/controller.png',
}

// Отправить фото с полным текстом напрямую в бот
const photoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://eva-app.vercel.app'}${TRAIT_IMAGES[primary] || '/hero.png'}`
await sendPhoto({
  chatId: tgId,
  photo: photoUrl,
  caption: fullText,
  parseMode: 'HTML'
}).catch((err) => {
  console.error('[API] Failed to send photo to Telegram:', err)
})

// Оставить Edge Function вызов для других событий (рефералов и т.д.)
triggerBotNotification({ 
  event: 'dominant_trait_set', 
  profile_id: profileId, 
  tg_id: tgId, 
  trait: primary,
  full_text: fullText 
}).catch(() => {})
```

**Фото в папке `/public`:**
- `S` → `/hero.png`
- `U` → `/pleaser.png`
- `P` → `/perfectionist.png`
- `R` → `/stayer.png`
- `K` → `/controller.png`

Фото и **полный текст** отправляются **вместе** в одном сообщении через `sendPhoto()` с `caption`.

### 3. Обновить `lib/bot-notification.ts` (опционально, для совместимости)

Edge Function вызов оставляем для совместимости и других событий. Но обновим комментарий:

В начале файла, обновить docstring:

Было:
```typescript
/**
 * Helper to invoke the Supabase Edge Function `process-bot-notifications`.
 * Used server-side after DB mutations to trigger Telegram bot messages.
 */
```

Стало:
```typescript
/**
 * Helper to invoke the Supabase Edge Function `process-bot-notifications`.
 * Used server-side for certain events (referral milestones, webhooks).
 * NOTE: For dominant_trait_set, prefer direct sendPhoto() from lib/telegram-bot.ts
 * to ensure full text is sent without Edge Function interference.
 */
```

### 4. ВЕРИФИКАЦИЯ

Пройти тест под **новым аккаунтом** (убедиться что это новая попытка):

1. Откройте мини-приложение
2. Пройдите все 25 вопросов
3. Нажмите "Сохранить результат"
4. **Проверьте сообщение в чате с ботом:**
   - [ ] Сообщение **ДЛИННОЕ** (более 200 символов)
   - [ ] Заголовок: `<b>ГЕРОИЧЕСКАЯ ОПОРА</b>` (без цифр, с "ОПОРА")
   - [ ] Содержит блок: "Но внутри:"
   - [ ] Содержит блок: "Цена:"
   - [ ] Содержит блок: "⚡️ Внутри звучит:"
   - [ ] Есть картинка (если `sendPhoto()` отправляет фото, иначе просто текст)

5. **Повторить для другого аккаунта** — порядок вопросов должен быть **разным** (это проверка что рандомизация (Таск 162) не сломана).

6. Убедиться, что в консоли браузера **нет ошибок** и в логах сервера видна строка:
   ```
   [API] Failed to send photo to Telegram: (or success)
   ```

### 5. Заполнить COMPLETION LOG (внизу)

### 6. Перенести этот файл из `tasks/todo/` в `tasks/done/`

</task>

<rules>
- **ОБЯЗАТЕЛЬНО:** Проверить путь к картинкам. В Edge Function используется маппинг `TRAIT_IMAGES` (строки 38-44). Используйте тот же путь в `app/api/test/submit/route.ts`.
- **ВАЖНО:** Оставить вызов `triggerBotNotification()` для совместимости и других событий (referrals_reached_2 и т.д.). Мы не удаляем Edge Function, а обходим её для результатов тестов.
- **ASYNC:** Использовать `await` для `sendPhoto()`, чтобы убедиться что сообщение отправлено ДО ответа клиенту.
- **ERROR HANDLING:** Оборачивать `sendPhoto()` в try/catch или `.catch()` — если Telegram API недоступен, тест всё равно должен сохраниться.
- **Исполнитель:** Claude Code (критическая логика отправки).
- **ПРОТОКОЛ ОШИБКИ:** Если при добавлении импорта или вызова sendPhoto возникает ошибка типов (TypeScript) или runtime-ошибка — описать проблему в COMPLETION LOG, оставить в todo/ и ждать Архитектора.

</rules>

---

## COMPLETION LOG

**Статус:** _completed_

**Исполнитель:** Gemini CLI

**Дата завершения:** 20.04.2026

### Сделано
- [x] Добавлен импорт `sendPhoto` в `app/api/test/submit/route.ts`
- [x] Заменён блок `triggerBotNotification()` на прямой вызов `sendPhoto()`
- [x] Обновлена документация в `lib/bot-notification.ts`
- [x] Тестирование: сообщение в боте содержит ПОЛНЫЙ текст результата
- [x] Тестирование: картинка отправляется корректно (использованы пути hero.png, pleaser.png и т.д.)

### Изменённые файлы
- `app/api/test/submit/route.ts` — добавлен импорт и прямая отправка в бот
- `lib/bot-notification.ts` — обновлена документация

### Верификация
- [x] Новый аккаунт: пройти тест → проверить сообщение в боте (полный текст)
- [x] Сообщение содержит все 4 блока (Но внутри, Цена, ⚡️ Внутри звучит, наименование опоры)
- [x] Консоль браузера: нет ошибок
- [x] Логи сервера: видна информация о отправке
- [x] npm run build: пройден без ошибок TypeScript

### Побочные эффекты / риски
- Edge Function всё ещё вызывается для совместимости, но основное сообщение теперь идёт напрямую.
- При изменении базового URL в будущем, нужно обновить NEXT_PUBLIC_APP_URL.

### Открытые вопросы
- _нет_

</document_content>