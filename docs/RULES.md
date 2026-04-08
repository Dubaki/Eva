# RULES — EVA

> Правила разработки проекта EVA
> Версия: 1.0 | Дата: 08.04.2026

---

## 🛠️ Утверждённый стек

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Framework | Next.js 14 (App Router) | 14.x |
| Язык | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Анимации | Framer Motion | 11.x |
| Database / Auth | Supabase JS Client | 2.x |
| Rate Limiting | @upstash/ratelimit | 1.x |
| Telegram SDK | @twa-dev/sdk | latest |

**Запрещено** добавлять зависимости без согласования. Стек зафиксирован Арбитром.

---

## ⛔ Строгие табу

### 1. ЗАПРЕТ на хардкод секретов

- **Никаких** токенов, ключей, паролей в коде.
- Все секреты хранятся **только** в `.env.local` (локально) и переменных окружения Vercel (продакшн).
- `.env.local` **обязательно** в `.gitignore`.
- Файлы `.env`, `.env.example` — без реальных значений, только плейсхолдеры.

**Запрещено:**
```ts
const botToken = "123456:ABC-DEF..."; // ❌ НИКОГДА
```

**Разрешено:**
```ts
const botToken = process.env.TELEGRAM_BOT_TOKEN; // ✅
```

---

### 2. Обязательная валидация initData по HMAC-SHA256

- **Все** API-роуты, принимающие данные от TMA, **обязаны** валидировать `initData`.
- Валидация происходит **ТОЛЬКО на сервере** (Next.js API Route).
- Алгоритм:
  1. Извлечь `hash` и строку данных из `initData`.
  2. `secret_key = HMAC-SHA256("WebAppData", TELEGRAM_BOT_TOKEN)`
  3. `expected_hash = HMAC-SHA256(data_check_string, secret_key)`
  4. Сравнить `expected_hash` с `hash` (constant-time compare).
  5. Проверить `auth_date` — не старше **300 секунд** (защита от replay-атак).
- Невалидный `initData` → ответ `401 Unauthorized`.

**Запрещено:**
- Доверять данным от клиента без серверной валидации.
- Валидировать `initData` на фронтенде.
- Использовать `initDataUnsafe` как источник истины.

---

### 3. Все БД-запросы с клиента только через RLS

- Пользователь видит **только свои данные**.
- **Все** таблицы в Supabase имеют включённый **Row Level Security**.
- RLS политики:
  - `SELECT`: `auth.uid() = profile_id` (или `id` для `profiles`)
  - `UPDATE`: `auth.uid() = profile_id` (или `id` для `profiles`)
  - `INSERT`: только через сервисный ключ из API Route
  - `DELETE`: запрещено для всех пользователей
- `referral_log`: INSERT только через сервисный ключ, SELECT запрещён для пользователей (append-only аудит).
- `service_role` ключ **никогда** не передаётся на клиент.

**Запрещено:**
```ts
// ❌ Клиентский код с service_role ключом
const supabase = createClient(url, SERVICE_ROLE_KEY)
```

**Разрешено:**
```ts
// ✅ Клиентский код с anon ключом + RLS
const supabase = createClient(url, ANON_KEY)
// RLS автоматически фильтрует по auth.uid()
```

---

## 📐 Стандарты кода

### Структура импортов
```ts
// 1. Внешние зависимости
import { createClient } from '@supabase/supabase-js'
// 2. Внутренние модули
import { validateInitData } from '@/lib/telegram'
// 3. Типы
import type { Profile } from '@/lib/types'
```

### Обработка ошибок
- Все API-роуты возвращают **единый формат** ответа:
```ts
// Успех
{ success: true, data: {...} }
// Ошибка
{ success: false, error: "Описание ошибки" }
```
- HTTP статус: `200` для успеха, `4xx` для клиентских ошибок, `5xx` для серверных.

### TypeScript
- `strict: true` в `tsconfig.json`.
- Запрещён `any`. Использовать `unknown` + type guard или конкретные типы.
- Все типы из БД генерируются автоматически через `supabase gen types`.

---

## 🔄 Git

- Коммиты **атомарные**: одно изменение = один коммит.
- Сообщения коммитов: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`
- Перед push: `npm run lint && npm run build` — должно проходить без ошибок.

---

## 🚀 Деплой

- **Vercel** — основной продакшн.
- Переменные окружения настраиваются в Vercel Dashboard.
- Webhook Telegram: `POST https://<domain>/api/webhook/telegram`
- Bot token и Supabase ключи **никогда** не коммитятся.
