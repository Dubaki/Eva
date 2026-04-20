📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
**ДИАГНОСТИКА:** В `app/api/test/submit/route.ts` допущены логические ошибки в реализации Таска 163.
1. Был оставлен вызов `triggerBotNotification` для `dominant_trait_set`, из-за чего Edge Function продолжает отправлять урезанные тексты.
2. Использование `sendPhoto` с длинным `caption` работает нестабильно, если `photoUrl` недоступен (например, на localhost), из-за чего вся отправка падает, и текст не доходит до пользователя.

**РЕШЕНИЕ:** Полностью удалить вызов `triggerBotNotification` из этого роута. Разделить отправку на два независимых вызова: `sendPhoto` (только картинка) и `sendMessage` (полный текст). Это гарантирует доставку текста даже при ошибках с URL картинки.
</context>

<task>
1. Открыть файл `app/api/test/submit/route.ts`.
2. В импортах на строке 7 (где импортируется `sendPhoto`) добавить импорт `sendMessage`:
   `import { sendPhoto, sendMessage } from '@/lib/telegram-bot'`
3. Найти блок отправки `// ── Direct Send to Telegram (Task 163) ──` и заменить его логику.
   **Новый алгоритм:**
   - Сначала попытаться отправить только фото (без `caption`). Обернуть в свой `catch`, чтобы ошибка не прерывала дальнейшую отправку.
   - Затем вызвать `sendMessage` для отправки полного текста (`fullText`).
4. **КРИТИЧНО:** Полностью удалить или закомментировать вызов `triggerBotNotification(...)`, который находится сразу после блока отправки (строки 131-137).
5. Верифицировать результат (локально): пройти тест, убедиться что бот присылает длинное сообщение.
6. Заполнить COMPLETION LOG.
7. Перенести этот файл из `tasks/todo/` в `tasks/done/` после завершения.

**Пример кода для замены (строки 118-137):**
```typescript
    // ── Direct Send to Telegram ──
    const TRAIT_IMAGES_MAP: Record<string, string> = {
      S: 'hero.png', U: 'pleaser.png', P: 'perfectionist.png',
      R: 'stayer.png', K: 'controller.png',
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '[https://eva-app.vercel.app](https://eva-app.vercel.app)'
    const imageName = TRAIT_IMAGES_MAP[primary] || 'hero.png'
    const photoUrl = `${appUrl}/${imageName}`

    try {
      // 1. Отправляем картинку (может не сработать на localhost, это нормально)
      await sendPhoto({
        chatId: tgId,
        photo: photoUrl,
      }).catch(err => console.warn('[API] Photo send skipped (likely localhost):', err.message))

      // 2. Гарантированно отправляем полный текст отдельным сообщением
      await sendMessage({
        chatId: tgId,
        text: fullText,
        parseMode: 'HTML'
      })
      console.log('[API] Direct text result sent successfully')
    } catch (err) {
      console.error('[API] Failed to send direct text to Telegram:', err)
    }

    // ВЫЗОВ triggerBotNotification УДАЛЕН.
</task>

<rules>

СТРОГО: Обязательно удалить triggerBotNotification.

Не изменять логику calculateScores или работу с JWT.

Исполнитель: Qwen Code.
</rules>
## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** Gemini CLI
**Изменения:**
- В `app/api/test/submit/route.ts` разделена отправка фото и текста.
- Добавлен импорт `sendMessage`.
- Отправка фото теперь обернута в отдельный `catch`, что гарантирует доставку текста даже при ошибке загрузки изображения.
- Полностью удален вызов `triggerBotNotification` для события `dominant_trait_set`, чтобы исключить дублирование и отправку урезанных текстов из Edge Function.
**Результат верификации:** [x] Успешно. Текст отправляется отдельно от изображения, дублирующий вызов Edge Function удален.
Архитектор
Custom Gem
Я проанализировал код route.ts, который ты прислал, и нашел две критические ошибки, допущенные программистом в предыдущем таске. Хорошо, что мы не стали гадать!

Вот что происходит под капотом:

Главная причина: Программист забыл удалить вызов старой функции triggerBotNotification({ event: 'dominant_trait_set' ... }) в самом низу файла (строки 131-137). Из-за этого наша нестабильная Edge Function продолжает срабатывать и отправляет старый обрезанный текст.

Вторичная причина (почему ты вообще не увидел полного сообщения): Программист попытался отправить картинку и полный текст в одном сообщении через sendPhoto. Но если ты тестируешь локально (на localhost), Telegram API физически не может скачать картинку с твоего компьютера. Отправка фото падает с ошибкой, ошибка "проглатывается" в блоке catch, а затем срабатывает Edge Function и присылает короткий текст.

Как мы это исправим (железобетонно):
Мы разделим отправку. Сначала бот попытается отправить красивую картинку (если она доступна). А затем гарантированно отдельным сообщением пришлет полный текст через sendMessage (которому не нужны ссылки, он работает всегда). И главное — мы с корнем вырвем вызов Edge Function для этого события.

Скопируй этот таск и передай программисту.

Файл: tasks/todo/164_fix_bot_message_delivery_task.md
Markdown
📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
**ДИАГНОСТИКА:** В `app/api/test/submit/route.ts` допущены логические ошибки в реализации Таска 163.
1. Был оставлен вызов `triggerBotNotification` для `dominant_trait_set`, из-за чего Edge Function продолжает отправлять урезанные тексты.
2. Использование `sendPhoto` с длинным `caption` работает нестабильно, если `photoUrl` недоступен (например, на localhost), из-за чего вся отправка падает, и текст не доходит до пользователя.

**РЕШЕНИЕ:** Полностью удалить вызов `triggerBotNotification` из этого роута. Разделить отправку на два независимых вызова: `sendPhoto` (только картинка) и `sendMessage` (полный текст). Это гарантирует доставку текста даже при ошибках с URL картинки.
</context>

<task>
1. Открыть файл `app/api/test/submit/route.ts`.
2. В импортах на строке 7 (где импортируется `sendPhoto`) добавить импорт `sendMessage`:
   `import { sendPhoto, sendMessage } from '@/lib/telegram-bot'`
3. Найти блок отправки `// ── Direct Send to Telegram (Task 163) ──` и заменить его логику.
   **Новый алгоритм:**
   - Сначала попытаться отправить только фото (без `caption`). Обернуть в свой `catch`, чтобы ошибка не прерывала дальнейшую отправку.
   - Затем вызвать `sendMessage` для отправки полного текста (`fullText`).
4. **КРИТИЧНО:** Полностью удалить или закомментировать вызов `triggerBotNotification(...)`, который находится сразу после блока отправки (строки 131-137).
5. Верифицировать результат (локально): пройти тест, убедиться что бот присылает длинное сообщение.
6. Заполнить COMPLETION LOG.
7. Перенести этот файл из `tasks/todo/` в `tasks/done/` после завершения.

**Пример кода для замены (строки 118-137):**
```typescript
    // ── Direct Send to Telegram ──
    const TRAIT_IMAGES_MAP: Record<string, string> = {
      S: 'hero.png', U: 'pleaser.png', P: 'perfectionist.png',
      R: 'stayer.png', K: 'controller.png',
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '[https://eva-app.vercel.app](https://eva-app.vercel.app)'
    const imageName = TRAIT_IMAGES_MAP[primary] || 'hero.png'
    const photoUrl = `${appUrl}/${imageName}`

    try {
      // 1. Отправляем картинку (может не сработать на localhost, это нормально)
      await sendPhoto({
        chatId: tgId,
        photo: photoUrl,
      }).catch(err => console.warn('[API] Photo send skipped (likely localhost):', err.message))

      // 2. Гарантированно отправляем полный текст отдельным сообщением
      await sendMessage({
        chatId: tgId,
        text: fullText,
        parseMode: 'HTML'
      })
      console.log('[API] Direct text result sent successfully')
    } catch (err) {
      console.error('[API] Failed to send direct text to Telegram:', err)
    }

    // ВЫЗОВ triggerBotNotification УДАЛЕН.
</task>

<rules>

СТРОГО: Обязательно удалить triggerBotNotification.

Не изменять логику calculateScores или работу с JWT.

Исполнитель: Qwen Code.
</rules>

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** Gemini CLI
**Изменения:**
- В `app/api/test/submit/route.ts` разделена отправка фото и текста.
- Добавлен импорт `sendMessage`.
- Отправка фото теперь обернута в отдельный `catch`, что гарантирует доставку текста даже при ошибке загрузки изображения.
- Полностью удален вызов `triggerBotNotification` для события `dominant_trait_set`, чтобы исключить дублирование и отправку урезанных текстов из Edge Function.
**Результат верификации:** [x] Успешно. Текст отправляется отдельно от изображения, дублирующий вызов Edge Function удален.


---
