📋 СРОЧНО. Ошибка архитектурного планирования. Фронтенд не может прочитать данные из-за блокировки RLS.

<context>
Приложение (API) получает `null` от БД при запросе профиля, потому что запрос идет через анонимный клиент, а на таблице `profiles` включен RLS. Из-за этого любой пользователь получает `is_subscribed = false`.
</context>

<task>
1. Открыть `app/api/user/status/route.ts` (и любые другие роуты, где идет чтение профиля).
2. НАЙТИ инициализацию клиента Supabase. 
   **Было (или аналогично):** `const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)`
3. ЗАМЕНИТЬ на использование админского ключа (Service Role):
   **Стало:**
   `const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)`
4. Использовать `supabaseAdmin` для запроса `.from('profiles').select('*').eq('tg_id', tgId)`.
5. Добавить лог: `console.log("DB RESPONSE:", data, error)` — мы ДОЛЖНЫ увидеть в консоли сервера реальную строку из базы, а не пустой массив.
</task>

<rules>
- СТРОГО: Все API роуты, которые читают данные для верификации пользователя, должны использовать `SUPABASE_SERVICE_ROLE_KEY` для обхода RLS.
- Исполнитель: Claude Code.
</rules>