📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Интерфейс теста готов. Теперь необходимо развернуть бэкенд-инфраструктуру. Согласно методологии VibeCraft, настройка Supabase выполняется с подключением MCP сервера для обеспечения прямого контроля структуры БД со стороны ИИ-агентов.
</context>

<task>
1. Подключить MCP сервер для Supabase для прямого взаимодействия с проектом.
2. Создать SQL-миграции для таблиц (согласно BRIEF.md):
   - `profiles`: id (uuid/tg_id), username, first_name, photo_url, created_at, updated_at.
   - `test_results`: id, profile_id, performance, perfection, pleasing, control, hyper_vigilance, created_at.
   - `referrals`: id, referrer_id, referee_id, created_at.
   - `referral_log`: id, action_type, metadata, created_at.
3. Настроить RLS политики:
   - `profiles`: SELECT/UPDATE разрешен только владельцу (auth.uid() = id).
   - `test_results`: INSERT/SELECT только для владельца.
4. Инициализировать клиент в `lib/supabase.ts`, используя переменные окружения.
5. Обновить файл `docs/BRIEF.md`: отметить Phase 5 как "In Progress" и Task 006 как "DONE".
6. Перенести этот файл в tasks/done/ после завершения.
</task>

<rules>
- Обязательно наличие полей id, created_at, updated_at во всех таблицах.
- Использовать MCP для верификации созданной схемы.
- Режим: Standard.
- Исполнитель: Qwen Code.
</rules>