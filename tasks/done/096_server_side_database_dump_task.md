📋 КРИТИЧЕСКИЙ СБОЙ. API не видит данные из БД, несмотря на Service Role Key.

<context>
В БД Supabase точно стоит `TRUE` для tg_id 5930269100.
На фронтенде DEBUG показывает `ID=5930269100, Subscribed=false`.
Вероятные причины: 
1. Ошибка типов при запросе (string vs int8).
2. Ошибка извлечения данных из массива (data[0] vs data).
3. Тихий сбой (Silent Error) при обращении к Supabase.
</context>

<task>
1. **Открыть API:** `/api/user/status/route.ts`
2. **Исправить типы:** Жестко привести `tgId` к числу перед запросом: 
   `const numericTgId = Number(tgId);`
3. **Расширить ответ (Critical):** Выполнить запрос и сохранить ВСЁ:
   `const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('tg_id', numericTgId);`
4. **Отдать логи на клиент:** Изменить `NextResponse.json`, чтобы он передавал сырые данные на фронтенд:
   `return NextResponse.json({ is_subscribed: data?.[0]?.is_subscribed || false, raw_data: data, db_error: error });`
5. **Открыть Frontend:** `app/page.tsx` (или где стоит заглушка Gate).
6. **Вывести рентген на экран:** Дополнить текущий DEBUG-текст новыми переменными:
   `DEBUG: ID={tgId}, Sub: {userStatus?.is_subscribed}`
   `RAW DATA: {JSON.stringify(userStatus?.raw_data)}`
   `DB ERROR: {JSON.stringify(userStatus?.db_error)}`
7. Перенести этот файл в tasks/done/ и отчитаться.
</task>

<rules>
- СТРОГО: Мы должны увидеть на экране телефона переменные RAW DATA и DB ERROR. Это единственный способ понять, почему сервер теряет данные.
- Исполнитель: Claude Code.
</rules>