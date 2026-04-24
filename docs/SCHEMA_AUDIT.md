# SCHEMA AUDIT — EVA

> Аудит физической структуры таблиц базы данных Supabase
> Дата: 24.04.2026 | Task: 164

---

## 1. Table: `profiles`
Основная таблица пользователей и их прогресса.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Внутренний ID профиля |
| `tg_id` | BIGINT | UNIQUE, NOT NULL | Telegram User ID |
| `username` | VARCHAR | NULL | Юзернейм из Telegram |
| `avatar_url` | TEXT | NULL | Ссылка на фото профиля |
| `referrer_id` | UUID | REFERENCES profiles(id) | ID пригласившего пользователя |
| `is_subscribed` | BOOLEAN | DEFAULT FALSE | Статус подписки на канал |
| `subscription_checked_at` | TIMESTAMPTZ | NULL | Последняя проверка подписки |
| `subscribed_at` | TIMESTAMPTZ | NULL | Дата фактической подписки |
| `last_test_date` | TIMESTAMPTZ | NULL | Дата последнего прохождения теста |
| `selected_sphere` | VARCHAR | NULL | Сфера напряжения (для подарка) |
| `invites_count` | INTEGER | DEFAULT 0 | Счётчик подтвержденных подписок |
| `current_step` | INTEGER | DEFAULT NULL | Текущий вопрос теста (для Mini App) |
| `bot_quiz_step` | INTEGER | DEFAULT 0 | Текущий шаг квиза в боте |
| `last_bot_interaction` | TIMESTAMPTZ | NULL | Время последнего взаимодействия с ботом |
| `shared_at` | TIMESTAMPTZ | DEFAULT NULL | Дата последнего шеринга |
| `contact_author_clicked` | BOOLEAN | DEFAULT FALSE | Флаг запроса связи с автором |
| `reminded_at` | TIMESTAMPTZ | NULL | Метка последнего напоминания |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Дата регистрации |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Дата последнего обновления |

**Индексы:**
- `idx_profiles_tg_id` ON `tg_id`
- `idx_profiles_referrer_id` ON `referrer_id`

---

## 2. Table: `test_results`
Хранилище детальных результатов тестов.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | ID результата |
| `tg_id` | BIGINT | UNIQUE, NOT NULL | Telegram User ID (1:1) |
| `score_s` | SMALLINT | DEFAULT 0, CHECK (>=0) | Баллы: Самоценность |
| `score_u` | SMALLINT | DEFAULT 0, CHECK (>=0) | Баллы: Угодничество |
| `score_p` | SMALLINT | DEFAULT 0, CHECK (>=0) | Баллы: Перфекционизм |
| `score_r` | SMALLINT | DEFAULT 0, CHECK (>=0) | Баллы: Результативность |
| `score_k` | SMALLINT | DEFAULT 0, CHECK (>=0) | Баллы: Контроль |
| `primary_support` | TEXT | NOT NULL | Главная опора |
| `secondary_support` | TEXT | NOT NULL | Теневая опора |
| `answers` | JSONB | DEFAULT '[]' | Массив сырых ответов [ {questionId: N, score: M}, ... ] |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Дата завершения теста |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## 3. Table: `qualifications`
Данные по квалификационному квизу в боте.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | ID |
| `profile_id` | UUID | UNIQUE, REFERENCES profiles(id) | Связь с профилем |
| `current_tension_sphere` | TEXT | NOT NULL | Выбранная сфера напряжения |
| `tension_severity` | TEXT | NOT NULL | Степень остроты проблемы |
| `previous_experience` | TEXT | NOT NULL | Предыдущий опыт решения |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## 4. Row Level Security (RLS) Audit

### `profiles`
- `SELECT`: `auth.uid() = id` (Пользователь видит только себя)
- `UPDATE`: `auth.uid() = id` (Пользователь меняет только себя)

### `test_results`
- `SELECT`: `(SELECT tg_id FROM profiles WHERE id = auth.uid()) = tg_id`
- `INSERT`: `(SELECT tg_id FROM profiles WHERE id = auth.uid()) = tg_id`

---

## 5. Выводы аудита
1. Структура синхронизирована с фактической БД.
2. Использование `tg_id` в `test_results` упрощает интеграцию с ботом.
3. Поля квалификации приведены к финальным названиям.
