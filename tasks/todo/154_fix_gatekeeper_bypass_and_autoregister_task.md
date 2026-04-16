<context>
КРИТИЧЕСКИЙ БАГ ФИНАЛЬНОГО РЕЛИЗА: 
1. Уязвимость Bypass: Пользователи могут обойти экран подписки, зайдя через кнопку "App" в меню Telegram. Gatekeeper "падает" в открытое состояние, если не успевает прочитать `tgId`.
2. Ошибка "Кнопка не работает": Новые пользователи (без созданного профиля) нажимают "Я подписалась", но `/api/subscription/confirm` возвращает 401, так как профиля еще нет в БД.
3. Дублирование кода: `page.tsx` всё ещё содержит логику проверки подписки и экран блокировки, конфликтуя с `Gatekeeper.tsx`.

ЗАВИСИМОСТИ: 153
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ: `components/Gatekeeper.tsx`, `app/page.tsx`, `app/api/subscription/confirm/route.ts`
ТИП: hotfix / refactor
</context>

<task>
1. **Gatekeeper: Закрытие уязвимости (Fail Closed):**
   - В `components/Gatekeeper.tsx`, если `!currentTgId` (Telegram ID не найден), НЕЛЬЗЯ делать `blocked: false`. 
   - Вместо этого нужно установить `blocked: true, reason: 'no_webapp'`. Приложение должно строго блокировать доступ, если не может подтвердить личность.
2. **API: Авто-регистрация при проверке подписки:**
   - В `app/api/subscription/confirm/route.ts`, в блоке `} else if (bodyTgId) {`:
   - Если после `supabaseAdmin.from('profiles').select...` профиль `profileData` не найден, **НЕ ВОЗВРАЩАТЬ 401**.
   - Вместо этого ВЫПОЛНИТЬ UPSERT: создать новый профиль с этим `tg_id` и `is_subscribed: false`. После создания присвоить его данные в `profileData` и продолжить логику проверки подписки.
3. **Page.tsx: Тотальная зачистка:**
   - УДАЛИТЬ из `app/page.tsx` все состояния `checking`, `notSubscribed`, `confirmingSub`, `subError`.
   - УДАЛИТЬ хук `useEffect`, который делает `fetch('/api/user/status')`.
   - УДАЛИТЬ функцию `handleConfirmSubscription`.
   - УДАЛИТЬ JSX-блоки `if (checking)` и `if (notSubscribed)`.
   - `page.tsx` должен ТОЛЬКО получать `cooldownDays` через `const { cooldownDays } = useGatekeeper()` и рендерить Главную страницу (текст про опору и кнопку "Пройти тест").
4. **Верификация:**
   - Попытаться зайти в приложение без подписки через кнопку App — должен появиться экран блокировки.
   - Нажать "Я подписалась" новым аккаунтом — профиль должен создаться, подписка провериться, и приложение должно пустить к тесту.
5. Заполнить COMPLETION LOG.
</task>

<rules>
- СТАБИЛЬНОСТЬ: `Gatekeeper` теперь единственный источник истины. Если он говорит `blocked: false`, `page.tsx` просто рендерится.
- Исполнитель: Claude Code.
</rules>

---

## COMPLETION LOG
**Статус:** _pending_
**Исполнитель:** ___