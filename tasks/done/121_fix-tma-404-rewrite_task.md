📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Настройки BotFather корректны (Short Name = 'app', URL = 'https://eva-9udm.vercel.app/'). Однако прямая ссылка t.me/sprosievubot/app вызывает 404 Vercel. Вероятно, Telegram пытается открыть эндпоинт `/app`, которого нет в структуре проекта.
</context>

<task>
1. Добавить в `next.config.js` правило `rewrites`, которое перенаправляет все запросы с `/app` на корень `/`.
   Пример: `source: '/app', destination: '/'`.
2. Если используется Middleware, убедиться, что оно не блокирует запросы с параметрами `startapp`.
3. В корневом компоненте `app/page.tsx` добавить проверку: если приложение открыто по пути `/app`, оно должно корректно инициализировать Telegram WebApp и считывать `start_param`.
4. Проверить генерацию реферальной ссылки: она должна оставаться `https://t.me/sprosievubot/app?startapp=[ID]`.
5. Перенести этот файл из tasks/todo/ в tasks/done/ после завершения.
</task>

<rules>
- Не менять домен в BotFather.
- Цель: чтобы ссылка t.me/sprosievubot/app открывала главную страницу приложения без ошибки 404.
- Исполнитель: Claude Code.
</rules>