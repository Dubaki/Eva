📋 Прочитай docs/BOOT.md.

<context>
1. Фронтенд пускает в Админку по PIN-коду, но бэкенд `/api/admin/stats` отклоняет запрос. Нужно перевести API на проверку PIN-кода.
2. Бот не отправляет сообщения. Секрет TELEGRAM_BOT_TOKEN уже добавлен пользователем в панель Supabase вручную. 
3. Необходимо настроить Database Webhook и проверить логику Edge Function.
</context>

<task>
**ЧАСТЬ 1: Фикс доступа к статистике (Бэкенд + Фронтенд)**
1. Во фронтенде (AdminPanel): При запросе к `/api/admin/stats` передавать PIN-код (2026) в заголовке `x-admin-pin`.
2. На бэкенде (`app/api/admin/stats/route.ts`): Проверять заголовок `x-admin-pin`. Если он равен `2026`, разрешать доступ к данным через Service Role Key.

**ЧАСТЬ 2: Настройка секретного входа**
3. На главном экране УДАЛИТЬ видимую кнопку "Админ-панель".
4. Реализовать вход: 5 быстрых кликов по заголовку "У каждого человека есть внутренняя «опора»" -> `window.prompt` для ввода PIN -> сохранение в localStorage -> редирект в `/admin`.

**ЧАСТЬ 3: Активация Бота через Supabase Webhook**
5. **ВАЖНО:** Пользователь уже добавил `TELEGRAM_BOT_TOKEN` в Secrets панели Supabase.
6. Проверить/настроить Database Webhook в панели Supabase:
   - Name: `send_result_to_bot`
   - Table: `profiles`
   - Events: `INSERT`, `UPDATE`
   - Target: Supabase Edge Function (`process-bot-notifications`)
7. В коде Edge Function (`process-bot-notifications`) убедиться, что:
   - `chat_id` извлекается из `payload.record.tg_id`.
   - Логика отправки использует `Deno.env.get("TELEGRAM_BOT_TOKEN")`.
   - Добавлены подробные `console.log` для отладки в панели Supabase (вкладка Logs).

**ЧАСТЬ 4: Реферальный текст и Орфография**
8. Кнопка [Поделиться]: предустановить текст "Пройди этот тест и узнай, какой механизм снова и снова приводит тебя к одним и тем же проблемам."
9. Исправить "по этому" -> "поэтому" (слитно) во всем приложении.

10. Сделать git push и перенести в done/.
</task>