# COUNCIL — EVA (Web App Version)

> Дата создания: 08.04.2026
> Тема: Перезапуск — Переход на Telegram Mini App (TMA)

---

## ⛔ ПРАВИЛА СОВЕТА
1. Каждый участник пишет ТОЛЬКО в своём блоке.
2. ЗАПРЕЩЕНО изменять блоки других участников.
3. Решение Арбитра (Claude Code) — ФИНАЛЬНОЕ.

---

## ВХОДНЫЕ ДАННЫЕ ОТ ЗАКАЗЧИКА
- **Продукт:** Telegram Mini App «Тест на искажённые опоры».
- **Цель:** Максимальный WOW-эффект, премиальный дизайн, виральность через рефералов.
- **Функционал:** Плавный Web-интерфейс теста (25 вопросов), реферальная система (2 друга = 2-й слой), интеграция с Telegram-каналом (Force Sub).

---

## БЛОК АРХИТЕКТОРА
*Подпись: Архитектор (Gemini Web)*
*Скилл: PROJECT_GENESIS*

### [Executive Summary]
Проект EVA переводится в формат Telegram Mini App (TMA). Это позволяет реализовать интерактивный UX с анимациями и сложной визуализацией результатов. Основной вызов — бесшовная авторизация через Telegram WebApp и синхронизация статуса подписки на канал для разблокировки контента внутри веба.

### [Domain & Stack Justification]
| Component | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router) | Единый стек для Frontend и API-роутов |
| **Styling** | Tailwind CSS + Framer Motion | Премиальный UI и плавные анимации |
| **Database/Auth** | Supabase | Хранение данных, Auth и Realtime-обновления |
| **Bot Logic** | Python (aiogram 3.x) | Легкий сервис для Force-sub и рассылок |
| **UI Quality** | **Impeccable Skill** | Гарантия профессионального дизайна |

### [Database Schema]
- **profiles:** id (UUID), tg_id (Unique), username, avatar_url, referrer_id, is_subscribed (bool), created_at.
- **test_results:** id, profile_id, s_score, u_score, p_score, r_score, k_score, type (dominant/secondary), created_at.
- **referrals:** id, owner_id, invited_id, status (joined/subscribed), updated_at.

### [Core API/Endpoints]
- `GET /api/auth`: Валидация `initData` от Telegram.
- `POST /api/test/submit`: Сохранение ответов и расчет опор.
- `GET /api/referrals`: Статус приглашенных друзей.
- `POST /api/bot/check-sub`: Проверка подписки через Telegram API.

### [Security]
- Использование **Supabase RLS** (Row Level Security): пользователь видит только свои результаты.
- Валидация `hash` в `initData` на стороне сервера для предотвращения подделки данных.

---

## БЛОК АУДИТОРА
*Подпись: Аудитор (Qwen Code)*
*Скилл: STRUCTURE_AUDITOR*
*Дата: 08.04.2026*

### Согласен с Архитектором:
- Переход на Telegram Mini App (TMA) — обоснован ради WOW-эффекта, анимаций и премиального UX. Это значительно повышает виральность.
- Next.js 14 (App Router) + Tailwind + Framer Motion — отличный стек для быстрого, красивого и SEO-оптимизированного веб-приложения.
- Supabase — разумный выбор для быстрого старта: встроенная авторизация, RLS, realtime и PostgreSQL «из коробки».
- Валидация `initData` на сервере — единственно верный подход для безопасности.

### Замечания:

1. **[Категория: Логика]**
   Проблема: Разрозненность данных между Python-ботом и Supabase.
   Обоснование: Бот (aiogram) должен проверять подписку и рассылать сообщения, но не указано, как он подключается к Supabase. Без этого бот не узнает, кто прошёл тест, и не обновит `is_subscribed`.
   Решение: Добавить Supabase Python SDK (`supabase-py`) в зависимости бота. Бот подключается к той же Supabase базе через API ключ. Альтернатива: вынести логику бота в Next.js API routes (upstash/Telegram Bot API), убрав Python полностью.

2. **[Категория: Логика]**
   Проблема: Схема БД неполная — отсутствует таблица `qualifications`.
   Обоснование: В оригинальном ТЗ есть квалификационный опрос (3 вопроса: сфера напряжения, уровень, прошлые попытки). Без этой таблицы бизнес-логика квалификации теряется.
   Решение: Добавить таблицу `qualifications`: `id (UUID)`, `profile_id (UUID, UNIQUE)`, `tension_sphere`, `tension_level`, `previous_attempts`, `created_at`, `updated_at`.

3. **[Категория: Логика]**
   Проблема: Поле `type (dominant/secondary)` в `test_results` спроектировано некорректно.
   Обоснование: Одна запись результата теста должна хранить все 5 баллов (s_score…k_score) + вычисленные `dominant_trait` и `secondary_trait`. Поле `type` создаёт путаницу: нужно ли 2 записи на один тест?
   Решение: Заменить `type` на `dominant_trait (VARCHAR)` и `secondary_trait (VARCHAR)`. Добавить CHECK-констрейнт: `dominant_trait != secondary_trait`.

4. **[Категория: Логика]**
   Проблема: В `referrals` нет поля `created_at` и механизма передачи `referrer_id` в TMA.
   Обоснование: Без `created_at` невозможно ограничить рефералы за период. Без механизма передачи `start_param` из бота в WebApp реферальная система не работает — TMA не узнает, кто пригласил.
   Решение: Добавить `created_at TIMESTAMPTZ DEFAULT NOW()` в `referrals`. Передавать `start_param` через `WebApp.initData` (бот генерирует URL вида `https://app.com/?ref=123` и передаёт в `answerWebAppQuery`).

5. **[Категория: Безопасность]**
   Проблема: Не описан механизм аутентификации в Supabase через Telegram.
   Обоснование: Supabase Auth работает с email, phone, OAuth-провайдерами. Telegram не является стандартным провайдером. Без корректного маппинга `initData` → Supabase JWT, RLS не сможет идентифицировать пользователя.
   Решение: Использовать Supabase Custom Auth: Next.js API route валидирует `initData`, генерирует JWT через `supabase.auth.signInWithCustomToken` или создаёт запись в `auth.users` через сервисный ключ. `tg_id` сохраняется в `raw_user_meta_data`.

6. **[Категория: Безопасность]**
   Проблема: Отсутствие rate limiting на Next.js API routes.
   Обоснование: Эндпоинты `/api/test/submit`, `/api/referrals` уязвимы к спаму и накрутке. Supabase имеет свои лимиты, но они не защищают от множественных запросий к API.
   Решение: Добавить middleware Next.js с rate limiting (например, `@upstash/ratelimit` на бесплатном тире Upstash Redis). Лимит: 5 запросов в минуту на `tg_id`.

7. **[Категория: Безопасность]**
   Проблема: Проверка подписки (`getChatMember`) без кэширования.
   Обоснование: Telegram API блокирует за спам запросами. Пользователь может обновлять страницу TMA многократно, вызывая проверку каждый раз.
   Решение: Кэшировать статус в Supabase (поле `is_subscribed` с `updated_at`). Обновлять принудительно только по кнопке «Я подписался». Добавить TTL 5 минут на стороне API.

8. **[Категория: Избыточность]**
   Проблема: Python-бот может быть избыточен.
   Обоснование: Если бот只做 force-sub проверку и рассылки, его функционал можно реализовать в Next.js API routes через Telegram Bot HTTP API. Это убирает необходимость отдельного сервиса и упрощает деплой.
   Решение: Оценить два варианта: (А) Оставить Python, если планируются сложные сценарии (FSM, inline-кнопки, обработка сообщений). (Б) Перенести всю логику в Next.js, если бот только для `/start` и проверки подписки. Для MVP вариант Б предпочтительнее.

9. **[Категория: Реализуемость]**
   Проблема: Не описан процесс деплоя.
   Обоснование: Next.js + Supabase — это минимум 2 сервиса. Нужен Vercel/Neon или self-hosted. Неясно, как связываются переменные окружения, webhook для бота и т.д.
   Решение: Добавить секцию `[Deployment]`: Vercel (Next.js) + Supabase Cloud (бесплатный тир). Bot webhook → Vercel API route (`/api/webhook/telegram`). Указать необходимые env-переменные: `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_WEBHOOK_SECRET`.

### Оценка уверенности (Quality Gates):

| Критерий | Оценка (0–100) | Статус |
|----------|---------------|--------|
| A. Логика (сущности, связи, edge-cases) | 55 | 🚫 FAIL (<70) |
| B. Стек (оптимальность для задачи) | 85 | ✅ PASS (≥70) |
| C. Безопасность (auth, rate limits, валидация) | 50 | 🚫 FAIL (<70) |
| D. Избыточность (нет лишнего) | 65 | 🚫 FAIL (<70) |
| E. Реализуемость (можно собрать конвейером) | 75 | ✅ PASS (≥70) |
| **СРЕДНИЙ БАЛЛ** | **66** | |

**Вердикт:**
- 60–79: **УСЛОВНО** — требуются правки по пунктам FAIL (A. Логика, C. Безопасность, D. Избыточность)

### Моя финальная версия:

```
# [Database Schema — ДОПОЛНЕННАЯ]

TABLE: profiles
PURPOSE: Профили пользователей с реферальными связями.
──────────────────────────────────────────────
id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid()
tg_id                   BIGINT          UNIQUE NOT NULL
username                VARCHAR         NULL
avatar_url              TEXT            NULL
referrer_tg_id          BIGINT          NULL
is_subscribed           BOOLEAN         DEFAULT FALSE
subscription_checked_at TIMESTAMPTZ     NULL — timestamp последней проверки
created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

CONSTRAINT: CHECK (referrer_tg_id != tg_id)

TABLE: test_results
PURPOSE: Результаты прохождения теста (один на пользователя).
──────────────────────────────────────────────
id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid()
profile_id              UUID            NOT NULL UNIQUE — один результат на пользователя
score_s                 INTEGER         DEFAULT 0 CHECK (score_s >= 0)
score_u                 INTEGER         DEFAULT 0 CHECK (score_u >= 0)
score_p                 INTEGER         DEFAULT 0 CHECK (score_p >= 0)
score_r                 INTEGER         DEFAULT 0 CHECK (score_r >= 0)
score_k                 INTEGER         DEFAULT 0 CHECK (score_k >= 0)
dominant_trait          VARCHAR         NOT NULL
secondary_trait         VARCHAR         NOT NULL
created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

CONSTRAINT: CHECK (dominant_trait != secondary_trait)

TABLE: qualifications
PURPOSE: Ответы на квалификационный опрос.
──────────────────────────────────────────────
id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid()
profile_id              UUID            NOT NULL UNIQUE
tension_sphere          VARCHAR         NOT NULL
tension_level           VARCHAR         NOT NULL
previous_attempts       VARCHAR         NOT NULL
created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

TABLE: referrals
PURPOSE: Трекинг реферальных приглашений.
──────────────────────────────────────────────
id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid()
owner_tg_id             BIGINT          NOT NULL
invited_tg_id           BIGINT          NOT NULL
status                  VARCHAR         NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'subscribed'))
created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

INDEXES: (owner_tg_id, created_at) — лимит за период; (invited_tg_id) — проверка петель
CONSTRAINT: UNIQUE (owner_tg_id, invited_tg_id)

TABLE: referral_log (аудит)
PURPOSE: Логирование всех реферальных действий для модерации.
──────────────────────────────────────────────
id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid()
owner_tg_id             BIGINT          NOT NULL
action                  VARCHAR         NOT NULL
details                 JSONB           NULL
created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

RELATIONSHIPS
─────────────
profiles  1──1  test_results     (profiles.id → test_results.profile_id)
profiles  1──1  qualifications   (profiles.id → qualifications.profile_id)
profiles  1──N  referrals        (profiles.tg_id → referrals.owner_tg_id)

# [Core API/Endpoints — ДОПОЛНЕНИЯ]

NEXT.JS API ROUTES
  GET  /api/auth              — Валидация initData, выдача Supabase JWT
  POST /api/test/submit       — Сохранение ответов, расчет опор, RLS check
  GET  /api/referrals         — Статус приглашений (кэшировано)
  POST /api/webhook/telegram  — Webhook для бота (force-sub, уведомления)
  POST /api/bot/check-sub     — Cron/hook для обновления статуса подписки

BOT COMMANDS (если Python остаётся)
  /start                      — Приветствие + кнопка "Открыть TMA" с ref в URL
  /my_results                 — Показ последнего результата (дублирует TMA)

# [Auth Flow — Telegram → Supabase]

1. Пользователь открывает TMA → Telegram передаёт `initData` (подписанный объект).
2. Frontend отправляет `initData` на `POST /api/auth`.
3. Next.js валидирует `hash` через HMAC-SHA256 с `BOT_TOKEN`.
4. При успехе: создаётся/находится профиль в `profiles` по `tg_id`.
5. Next.js генерирует JWT через Supabase Custom Token (`auth.users`).
6. Frontend получает JWT и использует его для всех последующих запросов к Supabase.
7. RLS политики фильтруют данные по `auth.uid()` → `profiles.id`.

# [Referral Flow — Deep Link в TMA]

1. Бот генерирует ссылку: `https://app.com/?ref={tg_id}`.
2. Приглашённый нажимает → бот получает `/start?start=ref{TG_ID}`.
3. Бот вызывает `answerWebAppQuery` с URL `https://app.com/?ref={TG_ID}`.
4. TMA извлекает `ref` из URL query → отправляет на `/api/referrals/apply`.
5. API проверяет циклические ссылки (BFS до 5 уровней) → записывает в `referrals`.

# [Security Additions]

1. Rate Limiting: @upstash/ratelimit на все API routes (5 req/min на tg_id).
2. initData валидация ТОЛЬКО на сервере (Next.js API route).
3. RLS политики на все таблицы: `auth.uid() = profile_id`.
4. Кэш подписки: TTL 5 мин в API, принудительное обновление по кнопке.
5. Referral anti-fraud: UNIQUE (owner, invited), проверка петель, лимит 10/24ч.

# [Deployment]

SERVICE             PROVIDER              NOTES
Next.js App         Vercel (Free)         Автоматический деплой из GitHub
Supabase            Supabase Cloud        Бесплатный тир: 500MB БД, 2GB bandwidth
Telegram Bot        Vercel Serverless     Webhook → /api/webhook/telegram
Redis (Rate Limit)  Upstash (Free)        10,000 команд/день бесплатно

ENV VARIABLES
  BOT_TOKEN              — токен Telegram бота
  SUPABASE_URL           — URL проекта Supabase
  SUPABASE_SERVICE_KEY   — сервисный ключ (server-side only)
  TELEGRAM_WEBHOOK_SECRET — секрет для валидации webhook
  CHANNEL_ID             — ID канала для проверки подписки

---

## БЛОК АРБИТРА
*Подпись: Арбитр (Claude Code)*
*Скилл: COUNCIL_ARBITER*
*Дата: 08.04.2026*
*Статус: ФИНАЛЬНОЕ РЕШЕНИЕ*

---

### Расхождения и решения:

| # | Вопрос | Архитектор | Аудитор | Решение | Обоснование |
|---|--------|-----------|---------|---------|-------------|
| 1 | Python-бот vs Next.js API Routes | Python (aiogram 3.x) — отдельный сервис | Вынести всё в Next.js API routes, убрать Python для MVP | **Аудитор прав.** Бот только для `/start` + force-sub = нет FSM, нет inline-кнопок с состоянием. | Python — избыточный сервис на MVP. Telegram Bot HTTP API покрывает все нужды из TypeScript. Один Vercel-деплой. Upside: после MVP легко ввести aiogram, не меняя БД. |
| 2 | Таблица `qualifications` | Отсутствует | Добавить с `tension_sphere`, `tension_level`, `previous_attempts` | **Аудитор прав.** | ТЗ прямо указывает квалификационный опрос. Потеря этих данных = потеря ключевой бизнес-метрики. |
| 3 | Поле `type` в `test_results` | `type (dominant/secondary)` — одно поле, неясная семантика | `dominant_trait VARCHAR` + `secondary_trait VARCHAR` + CHECK | **Аудитор прав.** | Одна запись теста = одна строка с обоими трейтами явно. CHECK-констрейнт исключает равенство. |
| 4 | `referrals.created_at` | Отсутствует | Добавить `created_at TIMESTAMPTZ DEFAULT NOW()` | **Аудитор прав.** | Без `created_at` невозможно считать рефералов за окно времени и применять anti-fraud лимиты. |
| 5 | Механизм Telegram → Supabase JWT | Упомянута валидация hash, детали не описаны | Custom Auth через сервисный ключ + JWT | **Аудитор прав, с уточнением.** Алгоритм ниже в §Авторизация. | Без явного маппинга `tg_id → auth.uid()` RLS не работает. |
| 6 | Rate limiting | Не упомянут | `@upstash/ratelimit`, 5 req/min на tg_id | **Аудитор прав.** | Открытые API routes без лимита = вектор накрутки. Upstash Free tier достаточен для MVP. |
| 7 | Кэш проверки подписки | `is_subscribed` без TTL | TTL 5 мин + принудительное обновление по кнопке | **Аудитор прав.** | Telegram API лимитирует `getChatMember`. Поле `subscription_checked_at` в `profiles` решает. |
| 8 | Описание деплоя | Отсутствует | Vercel + Supabase Cloud + Upstash, env-переменные | **Аудитор прав.** | Без описания деплоя архитектура нереализуема конвейером. |

---

### Пропуски обоих участников:

1. **`answers` таблица не обсуждалась.** 25 ответов теста нужно хранить для пересчёта и аудита. `test_results` хранит только итоги. Решение: поле `answers JSONB` в `test_results` (массив `{question_id, value}`). Отдельная таблица — over-engineering для MVP.
2. **Webhook security не закрыт полностью.** `TELEGRAM_WEBHOOK_SECRET` упомянут, но не описана валидация заголовка `X-Telegram-Bot-Api-Secret-Token` в middleware. Это обязательно.
3. **RLS для `referral_log` не описан.** Лог должен быть write-only для пользователей (INSERT через сервисный ключ), SELECT — только через сервисный ключ. Иначе пользователь читает чужой лог.
4. **`profiles.id` vs `profiles.tg_id` как FK.** Аудитор использует `tg_id` как FK в `referrals`. Архитектор — UUID. Финальное решение: везде UUID (`profiles.id`) как FK для консистентности с RLS (`auth.uid()`). В `referrals` — `owner_id UUID`, `invited_id UUID`.

---

### §Авторизация — Финальный алгоритм Telegram → Supabase JWT:

```
1. TMA загружается → Telegram.WebApp.initData доступен на клиенте.
2. Client: POST /api/auth { initData: string }
3. Server (Next.js API Route):
   a. Парсим initData, извлекаем hash и строку данных.
   b. Вычисляем secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
   c. Вычисляем expected_hash = HMAC-SHA256(data_check_string, secret_key)
   d. Сравниваем expected_hash с hash из initData (constant-time compare).
   e. Проверяем auth_date не старше 5 минут (защита от replay).
   f. Если невалидно → 401.
4. Server: Upsert в profiles через service_role ключ:
   INSERT INTO profiles (tg_id, username, avatar_url)
   VALUES ($tg_id, $username, $photo_url)
   ON CONFLICT (tg_id) DO UPDATE SET username=EXCLUDED.username
   RETURNING id
5. Server: Создаём Supabase Custom JWT:
   payload = { sub: profiles.id, role: "authenticated", aud: "authenticated" }
   jwt = sign(payload, SUPABASE_JWT_SECRET, { expiresIn: "7d" })
6. Server: Response { access_token: jwt, profile: { id, tg_id, ... } }
7. Client: supabase.auth.setSession({ access_token: jwt, refresh_token: "" })
8. Все последующие запросы к Supabase используют этот JWT.
9. RLS: auth.uid() = profiles.id → пользователь видит только свои строки.
```

**Env required:** `SUPABASE_JWT_SECRET` — берётся из Supabase Dashboard → Project Settings → API → JWT Secret.

---

### Вердикт: ПРИНЯТО С ПРАВКАМИ

Архитектура жизнеспособна. Все FAIL-критерии (Логика, Безопасность, Избыточность) закрыты решениями выше.

---

### Финальная структура проекта:

#### Стек:

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| Framework | Next.js 14 (App Router) | Frontend + API Routes в одном деплое |
| Styling | Tailwind CSS + Framer Motion | Требование WOW-эффекта от Заказчика |
| Database / Auth | Supabase (PostgreSQL + RLS) | Встроенная авторизация, RLS, бесплатный тир |
| Bot Logic | Next.js API Route `/api/webhook/telegram` | Telegram Bot HTTP API — достаточно для `/start` и force-sub |
| Rate Limiting | Upstash Redis + @upstash/ratelimit | 10k команд/день бесплатно, интеграция за 5 строк |
| Deployment | Vercel (Free) | Нативная интеграция с Next.js, автодеплой из GitHub |

**Python-бот исключён из MVP.** Возможен как v2 при появлении FSM-сценариев.

---

#### База данных (финальная схема):

```sql
-- profiles
id                      UUID         PK  DEFAULT gen_random_uuid()
tg_id                   BIGINT       UNIQUE NOT NULL
username                VARCHAR      NULL
avatar_url              TEXT         NULL
referrer_id             UUID         NULL REFERENCES profiles(id)
is_subscribed           BOOLEAN      DEFAULT FALSE
subscription_checked_at TIMESTAMPTZ  NULL
created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
CONSTRAINT: CHECK (referrer_id != id)

-- qualifications (1:1 с profiles)
id                  UUID         PK DEFAULT gen_random_uuid()
profile_id          UUID         NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE
tension_sphere      VARCHAR      NOT NULL
tension_level       VARCHAR      NOT NULL
previous_attempts   VARCHAR      NOT NULL
created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()

-- test_results (1:1 с profiles)
id               UUID         PK DEFAULT gen_random_uuid()
profile_id       UUID         NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE
score_s          SMALLINT     NOT NULL DEFAULT 0 CHECK (score_s >= 0)
score_u          SMALLINT     NOT NULL DEFAULT 0 CHECK (score_u >= 0)
score_p          SMALLINT     NOT NULL DEFAULT 0 CHECK (score_p >= 0)
score_r          SMALLINT     NOT NULL DEFAULT 0 CHECK (score_r >= 0)
score_k          SMALLINT     NOT NULL DEFAULT 0 CHECK (score_k >= 0)
dominant_trait   VARCHAR(1)   NOT NULL CHECK (dominant_trait IN ('S','U','P','R','K'))
secondary_trait  VARCHAR(1)   NOT NULL CHECK (secondary_trait IN ('S','U','P','R','K'))
answers          JSONB        NOT NULL DEFAULT '[]'
created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
CONSTRAINT: CHECK (dominant_trait != secondary_trait)

-- referrals (N:M через owner→invited)
id          UUID         PK DEFAULT gen_random_uuid()
owner_id    UUID         NOT NULL REFERENCES profiles(id)
invited_id  UUID         NOT NULL REFERENCES profiles(id)
status      VARCHAR      NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','subscribed'))
created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
UNIQUE (owner_id, invited_id)
CHECK (owner_id != invited_id)
INDEX (owner_id, created_at)   -- лимит за период
INDEX (invited_id)             -- анти-петля

-- referral_log (аудит, INSERT-only для users)
id          UUID         PK DEFAULT gen_random_uuid()
profile_id  UUID         NOT NULL REFERENCES profiles(id)
action      VARCHAR      NOT NULL
details     JSONB        NULL
created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
```

**RLS политики (для каждой таблицы):**
- `SELECT/UPDATE`: `auth.uid() = profile_id` (или `id` для profiles)
- `INSERT`: через сервисный ключ из API Route
- `referral_log`: INSERT через сервисный ключ, SELECT — запрещён для пользователей

---

#### API Routes (финальный список):

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth` | Валидация initData → Supabase JWT |
| POST | `/api/qualification/submit` | Сохранение квалификационного опроса |
| POST | `/api/test/submit` | Сохранение 25 ответов + расчёт опор |
| GET | `/api/referrals` | Статус приглашений текущего пользователя |
| POST | `/api/referrals/apply` | Применить реферальный код |
| POST | `/api/subscription/check` | Проверка подписки (с TTL 5 мин) |
| POST | `/api/webhook/telegram` | Webhook бота: `/start`, callback-кнопки |

**Middleware (глобально):** Rate limit 5 req/min per tg_id + валидация заголовка webhook-secret.

---

#### Безопасность (финальные требования):

1. `initData` валидируется ТОЛЬКО на сервере через HMAC-SHA256. Клиент не доверяется.
2. `auth_date` в `initData` не старше 300 секунд (защита от replay).
3. Supabase JWT подписывается `SUPABASE_JWT_SECRET` (server-side), срок жизни 7 дней.
4. RLS включён на всех таблицах. Service role key только на сервере, никогда в клиентском коде.
5. Webhook Telegram валидируется через `X-Telegram-Bot-Api-Secret-Token`.
6. Rate limit: `@upstash/ratelimit` 5 req/60s per tg_id на все `/api/*` routes.
7. Подписка кэшируется 5 мин (`subscription_checked_at`). Принудительное обновление — только по кнопке.
8. Anti-fraud рефералов: UNIQUE(owner_id, invited_id), CHECK(owner!=invited), лимит 10 рефералов/24ч.
9. `referral_log` — append-only аудит, недоступен на чтение через RLS.

---

#### Оценка сложности:

- **Примерное количество тасков: 24**
- **Критический путь:**
  ```
  [DB migrations] → [Auth /api/auth + JWT] → [Qualification submit] →
  [Test submit + scoring] → [Results page UI] → [Referral apply] →
  [Subscription check] → [Bot webhook /start + force-sub] → [Deploy + env]
  ```
- Параллельно с критическим путём: UI-компоненты (вопросы, анимации, результаты)
- Блокер для всего: `SUPABASE_JWT_SECRET` и `BOT_TOKEN` должны быть доступны на шаге 1

---

## 🏛️ ФУНДАМЕНТ ЗАЛОЖЕН — 08.04.2026