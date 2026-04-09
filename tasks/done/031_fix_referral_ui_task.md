📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Реферальная система (Task 029) была реализована на бэкенде, но не работает на клиенте. Нет генерации самой ссылки "Пригласить", и не снимается заглушка с Результата №2.
</context>

<task>
1. В `app/result/page.tsx` реализовать функцию кнопки "Пригласить друзей": она должна вызывать `window.Telegram.WebApp.openTelegramLink` с URL: `https://t.me/share/url?url=https://t.me/<BOT_USERNAME>/<APP_NAME>?startapp=ref_${userTgId}&text=Пройди тест!`
2. Временно добавить на экран (мелким серым текстом) debug-информацию: `Start Param: [val] | Invites: [count]`, чтобы Заказчик мог это протестировать.
3. Настроить снятие блюра (заглушки) с Результата №2, если `referral_count >= 2`.
4. Перенести этот файл из tasks/todo/ в tasks/done/ после завершения.
</task>

<rules>
- Имя бота брать из `.env.local`.
- Исполнитель: Claude Code.
</rules>