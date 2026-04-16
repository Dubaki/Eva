<context>
КРИТИЧЕСКИЙ РЕФАКТОРИНГ АВТОРИЗАЦИИ И UI:
1. Дублирование логики блокировки: `Gatekeeper.tsx` и `page.tsx` оба пытаются рендерить экран "Доступ закрыт", что приводит к race conditions (на одних устройствах есть кнопка "Я подписалась", на других нет).
2. Ошибка "Missing token": Роут `/api/subscription/confirm` жестко требует JWT, хотя фронтенд не всегда может его предоставить.
3. Ошибка сохранения теста у новых юзеров: `/api/test/submit` не находит профиль по `tgId`, если пользователь абсолютно новый и профиль еще не создан в БД.

ЗАВИСИМОСТИ: 151, 152
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ: `components/Gatekeeper.tsx`, `app/page.tsx`, `app/api/subscription/confirm/route.ts`, `app/api/test/submit/route.ts`
ТИП: refactor / hotfix
</context>

<task>
1. **Единый Gatekeeper (UI):**
   - ПЕРЕНЕСТИ логику кнопки "Я подписалась" (`handleConfirmSubscription` и соответствующий UI) из `app/page.tsx` в `components/Gatekeeper.tsx`.
   - В `Gatekeeper.tsx`, если `reason === 'not_subscribed'`, показывать экран с кнопкой "✅ Я подписалась".
   - УДАЛИТЬ стейт `notSubscribed` и весь заблокированный UI из `app/page.tsx`. `page.tsx` должен рендерить ТОЛЬКО контент главной страницы.
2. **Починка проверки подписки (API):**
   - В `app/api/subscription/confirm/route.ts` отключить жесткую проверку JWT-токена.
   - Читать `tgId` из тела запроса (`await request.json()`).
   - Использовать `supabaseAdmin` (с SERVICE_ROLE_KEY) для обновления статуса подписки `is_subscribed = true` по `tg_id`.
3. **Авто-регистрация при тесте (API):**
   - В `app/api/test/submit/route.ts` (в блоке fallback по `bodyTgId`): если профиль с таким `tg_id` НЕ найден, НЕ возвращать 401 ошибку.
   - ВМЕСТО ЭТОГО: Автоматически создать (upsert) профиль с этим `tg_id` в таблице `profiles`, получить его новый `id` и продолжить сохранение результатов.
4. **ВЕРИФИКАЦИЯ:**
   - Убедиться, что на Главной странице нет дублирования запросов к `/api/user/status`.
   - Убедиться, что при нажатии "Я подписалась" больше не возникает ошибка "Missing token".
5. Заполнить COMPLETION LOG.
</task>

<rules>
- СТАБИЛЬНОСТЬ: `Gatekeeper.tsx` становится единственным источником истины для блокировки контента.
- КЛЮЧИ: Везде, где нет JWT, используем fallback на `tgId` через `supabaseAdmin`.
- Исполнитель: Claude Code.
</rules>

---

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** _Gemini CLI_
**Изменения:**
- `Gatekeeper.tsx` теперь является единственным источником истины для блокировки контента (подписка, кулдаун).
- Логика подтверждения подписки перенесена из `page.tsx` в `Gatekeeper.tsx`.
- Создан `GatekeeperContext` для передачи состояния кулдауна в дочерние компоненты без дублирования запросов к API.
- В `/api/subscription/confirm` убрана обязательная проверка JWT, добавлен фоллбэк на `tgId`.
- В `/api/test/submit` добавлена авто-регистрация (upsert) профиля, если он не найден по `tgId`.