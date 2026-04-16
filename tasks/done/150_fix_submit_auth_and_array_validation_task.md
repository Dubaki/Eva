<context>
КРИТИЧЕСКИЙ ХОТФИКС: 
1. Ошибка 401 (Missing auth token) при сохранении теста. У новых пользователей отсутствует `eva_token` в `localStorage`, из-за чего API отклоняет запрос, несмотря на наличие `tgId` в body.
2. Ошибка 400 (Ожидается 25 ответов, получено 1). При восстановлении битого прогресса (currentStep = 24, массив пуст) фронтенд отправляет неполный массив ответов.

ЗАВИСИМОСТИ: 149
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ: `app/api/test/submit/route.ts`, `app/test/page.tsx`
ТИП: hotfix
</context>

<task>
1. **Умный фоллбэк авторизации (Backend - `route.ts`):**
   - Переписать начало POST-запроса. Сначала прочитать `const body = await request.json()`.
   - Если JWT-токен отсутствует или невалиден, НО в `body` передан `tgId` — использовать `supabaseAdmin` для поиска профиля по `tg_id` (получить `profileId`).
   - Возвращать 401 `Missing authorization token` ТОЛЬКО если нет ни валидного токена, ни валидного `tgId` в БД.
2. **Защита от битого стейта (Frontend - `page.tsx`):**
   - В функции `submitAnswers`, ПЕРЕД отправкой `fetch`, добавить проверку: 
     `if (answers.length !== QUESTIONS.length)`.
   - Если длины не совпадают, это значит стейт сломан. В этом случае:
     а) Сбросить прогресс: `setAnswersMap({})`, `setCurrentIndex(0)`.
     б) Показать пользователю `alert('Данные рассинхронизированы. Тест запущен заново для корректного сохранения.')`.
     в) Сделать `return` (прервать функцию submit).
3. **Логирование:**
   - В `route.ts` добавить логирование: `console.log('[test/submit] Using fallback tgId auth')`, если авторизация прошла по Telegram ID.
4. **ВЕРИФИКАЦИЯ (Проверка руками Программиста):**
   - Удалить `eva_token` из localStorage в браузере.
   - Пройти тест.
   - Убедиться, что `/api/test/submit` возвращает 200 OK благодаря фоллбэку по `tgId`.
5. Заполнить COMPLETION LOG.
</task>

<rules>
- СТАБИЛЬНОСТЬ: Не менять логику подсчета баллов (scoring). 
- КЛЮЧИ: Фоллбэк-поиск профиля по `tg_id` должен выполняться через `supabaseAdmin` с использованием `SERVICE_ROLE_KEY`.
- Исполнитель: Claude Code.
</rules>

---

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** _Gemini CLI_
**Файлы изменены:** `app/api/test/submit/route.ts`, `app/test/page.tsx`