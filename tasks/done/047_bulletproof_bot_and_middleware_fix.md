📋 Прочитай docs/BOOT.md перед выполнением.

<context>
1. Telegram выдает ошибку `wrong type of the web page content` при попытке отправить фото по URL. Это значит, что URL возвращает HTML (вероятно 404 или редирект от Middleware).
2. Бот замолкает при ошибке отправки фото. Нужен железный fallback на `sendMessage`.
</context>

<task>
1. **Обновить `middleware.ts`:**
   Убедиться, что статические файлы (картинки) исключены из защиты. В `matcher` должно быть что-то вроде:
   `matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']`
   Это позволит Telegram скачивать картинки напрямую.

2. **Добавить Fallback в `app/api/webhook/telegram/route.ts`:**
   - Обернуть вызовы `sendPhoto` (и в `/start`, и в `check_subscription`) в блоки `try...catch`.
   - Если `sendPhoto` падает, в блоке `catch` бот должен НЕМЕДЛЕННО отправить этот же текст (в формате HTML) и эти же кнопки через `sendMessage`.
   - Логика должна быть такой: "Попробовал отправить фото -> не вышло -> отправляю просто красивый текст -> пользователь идет дальше".

3. Убедиться, что пути к фото прописаны верно (`https://eva-9udm.vercel.app/start.png`), а сами файлы лежат строго в корне папки `public/` (с маленькой буквы).

4. Перенести в done/.
</task>

<rules>
- Исполнитель: Qwen Code.
- Никогда не оставлять бота молчать! Ошибка API Telegram не должна прерывать цепочку (graceful degradation).
- Оставить `parse_mode: "HTML"` для всех сообщений.
</rules>