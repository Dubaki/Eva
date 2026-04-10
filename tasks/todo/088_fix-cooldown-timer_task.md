📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Система авторизации была успешно переведена на прямой `tgId` из Telegram WebApp, минуя старые JWT-токены. Однако стартовый экран (`app/page.tsx` или `app/page.client.tsx`) всё ещё пытается использовать `localStorage.getItem('eva_token')` для проверки статуса пользователя (таймер 60 дней), из-за чего блокировка повторного прохождения не срабатывает.
</context>

<task>
1. **Обновить API (`app/api/user/status/route.ts`):** Изменить логику роута так, чтобы он принимал `tg_id` напрямую (например, через URL параметры `?tg_id=...` или заголовки) и возвращал профиль пользователя из БД (включая `last_test_date`), используя `SUPABASE_SERVICE_ROLE_KEY` для обхода RLS.
2. **Обновить Frontend (`app/page.tsx` или главный клиентский компонент):**
   Удалить логику с `localStorage.getItem('eva_token')`.
   Вместо этого получать `tgId` из Telegram:
   `const WebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;`
   `const currentTgId = WebApp?.initDataUnsafe?.user?.id;`
   Делать `fetch` к `/api/user/status?tg_id=${currentTgId}`.
3. Убедиться, что логика расчета 60 дней (которая уже есть в компоненте) корректно получает `lastTestDate` из нового ответа API и блокирует кнопку "Пройти тест".
4. Перенести этот файл в tasks/done/ и предоставить лог.
</task>

<rules>
- Использовать только прямое чтение `tgId` из Telegram Web App.
- Оставить текущую визуальную заглушку (кнопку серого цвета с текстом "Опора ещё формируется...").
- Исполнитель: Claude Code (или Qwen Code).
</rules>