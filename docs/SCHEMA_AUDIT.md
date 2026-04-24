# SCHEMA AUDIT — EVA

> Аудит физической структуры таблиц базы данных Supabase
> Дата: 16.04.2026 | Task: 145

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
| `subscribed_at` | TIMESTAMPTZ | NULL | Дата фактической подписки (Phase 11) |
| `last_test_date` | TIMESTAMPTZ | NULL | Дата последнего прохождения теста |
| `selected_sphere` | VARCHAR | NULL | Сфера напряжения (для подарка) |
| `referrals_count` | INTEGER | DEFAULT 0 | Кэш количества рефералов |
| `invites_count` | INTEGER | DEFAULT 0 | Счётчик подтвержденных подписок |
| `current_step` | INTEGER | DEFAULT NULL | Текущий вопрос теста (persistence) |
| `shared_at` | TIMESTAMPTZ | DEFAULT NULL | Дата последнего шеринга (Phase 11) |
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
| `primary_support` | VARCHAR(1) | NOT NULL, CHECK (S,U,P,R,K) | Главная опора |
| `secondary_support` | VARCHAR(1) | NOT NULL, CHECK (S,U,P,R,K) | Теневая опора |
| `answers` | JSONB | DEFAULT '[]' | Массив сырых ответов [1,0,1...] |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Дата завершения теста |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## 3. Row Level Security (RLS) Audit

### `profiles`
- `SELECT`: `auth.uid() = id` (Пользователь видит только себя)
- `UPDATE`: `auth.uid() = id` (Пользователь меняет только себя)
- `INSERT`: Разрешено через API (service_role) при регистрации.

### `test_results`
- `SELECT`: `(SELECT tg_id FROM profiles WHERE id = auth.uid()) = tg_id`
- `INSERT`: `(SELECT tg_id FROM profiles WHERE id = auth.uid()) = tg_id` (Валидируется через JWT)

---

## 4. Выводы аудита
1. Структура полностью соответствует требованиям Phase 11.
2. Все необходимые поля для Retention (subscribed_at, reminded_at) и AI-Assistant (current_step) присутствуют.
3. Типы данных в `lib/supabase/types.ts` синхронизированы с физической схемой.
