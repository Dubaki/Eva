📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Обязательная функция: Реферальная система. Доступ к "Результату №2" открывается только после 2-х приглашенных друзей.
</context>

<task>
1. В Supabase (таблица `profiles`) добавить колонки `referrer_id` (UUID) и `referral_count` (int, default 0).
2. В Mini App реализовать кнопку "Пригласить друзей": генерировать ссылку `https://t.me/share/url?url=...&text=...` с параметром `startapp=ref_{userId}`.
3. В логике инициализации (root layout или page) ловить `start_param`. Если он есть и пользователь новый — инкрементировать `referral_count` пригласившему.
4. В `app/result/page.tsx` добавить логику: если `referral_count < 2`, блок второго результата заблюрен (фильтр `blur-md`) с кнопкой "Пригласить еще [X] друзей".
5. Перенести этот файл из tasks/todo/ в tasks/done/ после завершения.
</task>

<rules>
- Использовать Telegram SDK для получения `start_param`.
- Не допускать само-рефералов (проверка `userId !== referrerId`).
- Исполнитель: Claude Code (требуется работа с API и БД).
</rules>