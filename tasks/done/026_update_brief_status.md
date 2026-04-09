📋 Прочитай docs/BOOT.md

<context>
Проект находится в стадии активного тестирования на Vercel. Базовая инфраструктура (БД, Деплой, Mini App SDK) настроена. Сейчас устраняются ошибки авторизации (401) и интерфейсные недочеты.
</context>

<task>
1. Обновить `docs/BRIEF.md`:
   - **Статус:** Изменить на "Beta Testing / Debugging".
   - **Phase 5 (Deployment):** Отметить как выполненную (Задеплоено на Vercel, привязан домен, настроен GitHub CI/CD).
   - **Текущие задачи:** Добавить пункт "Оптимизация UX (кнопка Назад) и исправление логики гостевого доступа".
   - **Технический стек:** Подтвердить интеграцию Supabase, Vercel и Telegram Mini Apps SDK.
2. После правок выполнить:
   `git add docs/BRIEF.md`
   `git commit -m "docs: update brief to reflect beta testing status"`
   `git push origin main`
3. Перенести файл в tasks/done/.
</task>

<rules>
- Исполнитель: Qwen Code.
- Пуш обязателен.
</rules>