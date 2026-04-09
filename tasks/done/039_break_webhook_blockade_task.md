📋 Прочитай docs/BOOT.md.

<context>
Telegram выдавал ошибку "Failed to resolve host". Вебхук переустановлен на https://eva-9udm.vercel.app/api/webhook/telegram.
</context>

<task>
1. В `app/api/webhook/telegram/route.ts` ДОБАВИТЬ `console.log("!!! WEBHOOK ATTEMPT !!!")` в самой первой строке функции POST.
2. ВРЕМЕННО УДАЛИТЬ проверку заголовка `x-telegram-bot-api-secret-token`. Нам нужно убедиться, что запросы доходят.
3. Убедиться, что Middleware НЕ перехватывает запросы к `/api/webhook/telegram`.
4. Сделать коммит и пуш.
</task>

<rules>
- Исполнитель: Qwen Code.
</rules>