📋 Прочитай docs/BOOT.md перед выполнением.

<context>
Бот работает, но не присылает фото и не всегда корректно проверяет подписку. Файл start.png добавлен в public/.
</context>

<task>
1. В `app/api/webhook/telegram/route.ts` обновить отправку фото:
   - Использовать полный URL: `https://eva-9udm.vercel.app/start.png`.
   - Убедиться, что вызов `sendPhoto` идет ПЕРЕД отправкой текста или вместе с ним (в одном сообщении с caption).
2. Обновить логику проверки подписки (`getChatMember`):
   - Считать успешной подпиской статусы: 'member', 'administrator', 'creator'.
   - Добавить логирование: `console.log("Check sub for channel:", process.env.TELEGRAM_CHANNEL_ID, "Status:", status)`.
3. Если фото всё равно не отправляется, добавить fallback: отправлять только текст, но логировать ошибку `photo_error`.
4. Перенести в done/.
</task>

<rules>
- Исполнитель: Qwen Code.
- Домен: https://eva-9udm.vercel.app/
</rules>