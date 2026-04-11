<context>
Бот падает с ошибкой в STEP 5.1, так как ищет колонки `dominant_trait` и `shadow_trait` в таблице `profiles`. Реальные данные находятся в таблице `test_results` в колонках `primary_support` и `secondary_support`. Нужно исправить логику получения данных пригласителя.
</context>

<task>
1. Открыть обработчик `check_sub` в `app/api/webhook/telegram/route.ts`.
2. Исправить логику в блоке `!!! STEP 5 !!!`:
   - При получении данных пригласителя (referrer), необходимо сделать дополнительный запрос к таблице `test_results`.
   - Запрос: `supabase.from('test_results').select('primary_support, secondary_support').eq('profile_id', referrer.id).single()`.
3. В логике отправки уведомления (где проверяется достижение 2 рефералов) использовать полученные из `test_results` данные:
   - Вместо `referrer.dominant_trait` использовать `testResult.primary_support`.
   - Вместо `referrer.shadow_trait` использовать `testResult.secondary_support`.
4. Удалить из кода любые упоминания несуществующих колонок `dominant_trait` или `shadow_trait` в таблице `profiles`.
5. Убедиться, что логика инкремента `invites_count` в `profiles` сохранена и работает.
6. Перенести файл в `tasks/done/` после деплоя.
</task>

<rules>
- Не переименовывать колонки в БД! Использовать `primary_support` и `secondary_support` из `test_results`.
- Сохранить логирование шагов (STEP 5, 6, 7), чтобы мы видели прогресс.
- Исполнитель: Claude Code.
</rules>