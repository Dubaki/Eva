📋 Прочитай docs/BOOT.md.

<context>
При открытии Админ-панели возникает ошибка "Не удалось загрузить статистику". Причина: Supabase RLS (Row Level Security) блокирует запрос на чтение всех строк из таблицы `profiles` при использовании обычного (anon) ключа на клиенте.
Нужно перенести получение статистики на защищенный серверный API-роут, использующий Service Role Key.
</context>

<task>
**ЧАСТЬ 1: Создание защищенного API-роута (Backend)**
1. Создать новый файл: `app/api/admin/stats/route.ts` (или аналогичный).
2. В этом роуте:
   - Извлечь `tg_id` из параметров запроса (URL search params или body).
   - Проверить права: `const TESTER_IDS = [1149371967, 5930269100, 1419397753];`. Если `tg_id` нет в списке — вернуть `403 Forbidden`.
   - Инициализировать клиент Supabase с правами администратора (для обхода RLS):
     ```typescript
     import { createClient } from '@supabase/supabase-js';
     const supabaseAdmin = createClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.SUPABASE_SERVICE_ROLE_KEY! // ВАЖНО: Использовать Service Role Key!
     );
     ```
   - Сделать запросы через `supabaseAdmin`:
     а) Получить общее количество пользователей.
     б) Получить распределение по опорам (сколько S, U, P, R, K).
     в) Получить последние 20 регистраций (с сортировкой по дате убывания).
   - Вернуть эти данные в формате JSON.

**ЧАСТЬ 2: Обновление Frontend (AdminPanel)**
3. В компоненте `AdminPanel`:
   - Убрать прямые запросы к `supabase.from('profiles')` со стороны клиента.
   - Вместо этого делать `fetch('/api/admin/stats?tg_id=' + user.tg_id)` к нашему новому роуту.
   - Обработать ответ и сохранить данные в `useState`.
   - Если сервер возвращает ошибку, вывести её в консоль (`console.error`), чтобы было легче дебажить.

4. Сделать git push и перенести в done/.
</task>

<rules>
- Исполнитель: Qwen Code.
- Никогда не передавать `SUPABASE_SERVICE_ROLE_KEY` на клиент (в браузер). Он должен использоваться только внутри `/api/...`.
</rules>