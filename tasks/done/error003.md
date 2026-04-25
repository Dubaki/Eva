ОШИБКА #4: ОТСУТСТВУЕТ profile_id В test_results
Суть ошибки
В коде (например, app/api/test/submit/route.ts строка 65-75) используется:const { error: dbError } = await supabaseAdmin.from('test_results').upsert({
  tg_id: tgId,
  primary_support: primary,
  secondary_support: secondary,
  answers: answers,
  // ...
})

Но в таблице test_results нет колонки profile_id! Это важно для связи с profiles.
Проблема: Если нужно JOIN'ить test_results с profiles (например, для аналитики или при удалении профиля), отсутствие profile_id усложняет запросы.
Промт для исправления
SQL миграция (добавить profile_id):

-- supabase/migrations/102_add_profile_id_to_test_results.sql

-- 1. Добавить колонку
ALTER TABLE test_results ADD COLUMN profile_id UUID DEFAULT NULL;

-- 2. Заполнить существующие данные (JOIN через tg_id)
UPDATE test_results tr
SET profile_id = p.id
FROM profiles p
WHERE tr.tg_id = p.tg_id;

-- 3. Сделать NOT NULL и добавить FK
ALTER TABLE test_results ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE test_results 
  ADD CONSTRAINT test_results_profile_id_fk 
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Добавить UNIQUE на profile_id (вместо tg_id)
ALTER TABLE test_results DROP CONSTRAINT test_results_tg_id_unique;
ALTER TABLE test_results ADD CONSTRAINT test_results_profile_id_unique UNIQUE (profile_id);

-- 5. Индекс для быстрого поиска
CREATE INDEX idx_test_results_profile_id ON test_results(profile_id);

Обновить код в /api/test/submit:// Вместо:
const { error: dbError } = await supabaseAdmin.from('test_results').upsert({
  tg_id: tgId,
  ...
}, { onConflict: 'tg_id' })

// Использовать:
const { error: dbError } = await supabaseAdmin.from('test_results').upsert({
  profile_id: profileId,  // ← Используем profileId
  tg_id: tgId,            // ← Оставляем для обратной совместимости
  ...
}, { onConflict: 'profile_id' })  // ← Конфликт по profile_id

