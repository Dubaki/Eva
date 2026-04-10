📋 Прочитай docs/BOOT.md перед выполнением.

<context>
Webhook установлен успешно. Была обнаружена путаница с токенами бота в .env.local. Нужно убедиться, что код использует актуальные ключи и не падает при работе с БД.
</context>

<task>
1. В `app/api/webhook/telegram/route.ts` добавить лог: 
   `console.log("DEBUG: Using Token ending in:", process.env.TELEGRAM_BOT_TOKEN?.slice(-5))`
2. Проверить инициализацию Supabase: убедиться, что используются `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.
3. Добавить `console.log("DEBUG: Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)` для сверки.
4. Реализовать логику: если запись в БД (profiles) не удается, бот ВСЁ РАВНО должен отправить ответ (sendMessage/sendPhoto) пользователю.
5. Убедиться, что в `upsert` в БД включено поле `avatar_url` (чтобы не было ошибки PGRST204).
6. Перенести в done/.
</task>

<rules>
- Исполнитель: Qwen Code.
- Токен из env: 
</rules>
