📋 Прочитай docs/BOOT.md.

<context>
Критический сбой: кнопка "Назад" не видна, "квадратик" мешает, отправка теста падает с ошибкой 401 (Unauthorized), бот не приветствует.
</context>

<task>
1. В `app/page.tsx`:
   - Вырезать подчистую индикатор загрузки (квадратик).
   - Текст кнопки: "Пройти тест".
2. В `app/test/page.tsx`:
   - Добавить кнопку "← Назад" (сделай её заметной, стили Tailwind: `bg-white/10 p-2 rounded`).
   - Исправить `handleSubmit`: если `tgUser` не найден, отправлять данные с `user_id: 'guest'`.
3. В `app/api/webhook/telegram/route.ts`:
   - Настроить ответ на `/start`: фото `pleaser.png` + текст "Привет — это канал СПРОСИ ЕВУ! Сегодня мы прекрасно проведём время вместе!".
4. В `app/result/page.tsx`:
   - Обеспечить показ результата даже если сессия ТГ нестабильна.
5. Выполнить `git add .`, `git commit -m "fix: core logic, back button and bot welcome"`, `git push origin main`.
</task>

<rules>
- Исполнитель: Claude Code.
- Пуш обязателен.
</rules>