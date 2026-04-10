<context>
Бот успешно проверяет статус подписки в Telegram, но транзакция в Supabase падает с ошибкой: `Could not find the 'subscribed_at' column of 'profiles'`. Причина в том, что в обновлении передается поле, которого нет в таблице БД.
</context>

<task>
1. Открыть файл с логикой обработчика кнопки подписки бота (скорее всего `lib/telegram-bot.ts` или `app/api/bot/route.ts` или `app/api/webhook/route.ts`).
2. Найти запрос на обновление: `supabaseAdmin.from('profiles').update(...)`.
3. ПОЛНОСТЬЮ УДАЛИТЬ поле `subscribed_at` (или любое другое поле, связанное с датой подписки) из объекта обновления.
4. Оставить в объекте обновления ТОЛЬКО `{ is_subscribed: true }`.
5. В конце задачи перенести этот файл task из папки tasks/todo в папку tasks/done.
</task>

<rules>
- СТРОГО: Никаких изменений схемы БД (schema). Меняем только код.
- Сохранить все текущие логи.
- Оставить `SUPABASE_SERVICE_ROLE_KEY` для авторизации запроса.
</rules>