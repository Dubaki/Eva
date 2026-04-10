📋 Прочитай docs/BOOT.md перед выполнением этого задания.

<context>
SQL-функция `save_test_result` уже создана Заказчиком в Supabase. Нам необходимо перевести Mini App на использование этой функции через RPC. Это решит проблему Foreign Key и обеспечит атомарность записи профиля и результата.
</context>

<task>
1. Найти в проекте Server Action или API route, отвечающий за сохранение результатов теста (ориентир: поиск по `test_results` или `insert`).
2. Заменить прямую запись в таблицы `profiles` и `test_results` на единый вызов RPC:
   ```typescript
   const { error } = await supabase.rpc('save_test_result', {
     p_tg_id: tgId,
     p_primary_support: primary,
     p_secondary_support: secondary
   });