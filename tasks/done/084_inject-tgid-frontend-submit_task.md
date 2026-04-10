📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
Серверная часть для сохранения результатов теста (route.ts) успешно переведена на прямое получение `tgId` и обход RLS. Теперь нам нужно научить фронтенд передавать этот `tgId` при отправке ответов. Точное расположение файла с фронтенд-логикой отправки теста неизвестно.
</context>

<task>
1. Выполнить глобальный поиск по проекту и найти React-компонент, который делает `fetch('/api/test/submit'` (вероятно, это `app/test/page.tsx`, `Quiz.tsx` или аналогичный файл).
2. В найденном компоненте добавить инициализацию Telegram Web App для получения ID:
   `const WebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;`
   `const currentTgId = WebApp?.initDataUnsafe?.user?.id;`
3. В функцию отправки результатов (там, где формируется `body` запроса) добавить передачу `tgId`. 
   Было: `body: JSON.stringify({ answers: ... })`
   Стало: `body: JSON.stringify({ answers: ..., tgId: currentTgId })`
4. Перенести этот файл из tasks/todo/ в tasks/done/.
5. В отчете (логе) ОБЯЗАТЕЛЬНО указать точный путь к файлу, который был изменен.
</task>

<rules>
- НЕ изменять серверный файл `app/api/test/submit/route.ts` (он уже готов).
- НЕ изменять дизайн или логику самих вопросов теста.
- Исполнитель: Claude Code (или Qwen Code).
</rules>