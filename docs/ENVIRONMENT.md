# ENVIRONMENT — EVA

> Переменные окружения и структура проекта
> Версия: 1.0 | Дата: 08.04.2026

---

## 🔑 Переменные окружения

Создайте файл `.env.local` в корне проекта со следующим содержимым:

```env
# === Supabase ===
# URL проекта Supabase (Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Anon-ключ (публичный, используется на клиенте с RLS)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service Role Key (ТОЛЬКО сервер, НИКОГДА на клиенте)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Secret (Dashboard → Project Settings → API → JWT Secret)
# Используется для подписи кастомных токенов Telegram → Supabase
SUPABASE_JWT_SECRET=your-jwt-secret-here

# === Telegram ===
# Токен бота от @BotFather
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# ID канала для проверки подписки (Force Sub)
# Формат: числовой ID (например, -1001234567890) или @username
TELEGRAM_CHANNEL_ID=-1001234567890

# === Upstash Redis (Rate Limiting) ===
# Dashboard → https://console.upstash.com/
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### Описание переменных

| Переменная | Где взять | Видимость | Обязательно |
|------------|-----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → API | Клиент + Сервер | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → API | Клиент + Сервер | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API | **Только сервер** | ✅ |
| `SUPABASE_JWT_SECRET` | Supabase Dashboard → API → JWT | **Только сервер** | ✅ |
| `TELEGRAM_BOT_TOKEN` | @BotFather | **Только сервер** | ✅ |
| `TELEGRAM_CHANNEL_ID` | Созданный канал | Сервер | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Dashboard | Сервер | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Dashboard | Сервер | ✅ |

---

## 📁 Структура проекта

```
eva/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Корневой layout (WebAppProvider, SupabaseProvider)
│   ├── page.tsx                  # Главная страница (маршрут: приветствие / тест / результаты)
│   ├── api/
│   │   ├── auth/
│   │   │   └── route.ts          # POST: Валидация initData → Supabase JWT
│   │   ├── qualification/
│   │   │   └── submit/
│   │   │       └── route.ts      # POST: Сохранение квалификационного опроса
│   │   ├── test/
│   │   │   └── submit/
│   │   │       └── route.ts      # POST: Сохранение 25 ответов + расчёт опор
│   │   ├── referrals/
│   │   │   ├── route.ts          # GET: Статус приглашений
│   │   │   └── apply/
│   │   │       └── route.ts      # POST: Применить реферальный код
│   │   ├── subscription/
│   │   │   └── check/
│   │   │       └── route.ts      # POST: Проверка подписки (TTL 5 мин)
│   │   └── webhook/
│   │       └── telegram/
│   │           └── route.ts      # POST: Webhook бота (/start, force-sub)
│   └── globals.css               # Глобальные стили + Tailwind директивы
├── components/                   # React-компоненты
│   ├── ui/                       # Базовые UI-элементы (кнопки, карточки, прогресс-бар)
│   ├── test/                     # Компоненты теста (вопрос, варианты, анимации)
│   ├── results/                  # Визуализация результатов (шкалы, доминантная опора)
│   ├── referral/                 # Реферальная система (ссылка, счётчик, прогресс)
│   └── layout/                   # Layout-компоненты (хедер, навигация)
├── lib/                          # Утилиты и бизнес-логика
│   ├── supabase/
│   │   ├── client.ts             # Клиент Supabase (клиентский, anon ключ)
│   │   ├── server.ts             # Клиент Supabase (серверный, service role)
│   │   └── types.ts              # Генерированные типы из БД
│   ├── telegram.ts               # Валидация initData (HMAC-SHA256)
│   ├── scoring.ts                # Расчёт доминантной/вторичной опоры
│   ├── referrals.ts              # Логика рефералов (проверка петель, лимиты)
│   ├── rate-limit.ts             # Upstash rate limiting middleware
│   └── types.ts                  # TypeScript типы/интерфейсы
├── middleware.ts                 # Next.js middleware (rate limiting)
├── public/                       # Статические ассеты (иконки, изображения)
├── supabase/
│   └── migrations/               # SQL миграции БД
│       └── 001_init_schema.sql   # Создание таблиц, индексов, RLS политик
├── docs/                         # Документация проекта
│   ├── COUNCIL.md                # Архитектурный совет (решения Арбитра)
│   ├── BRIEF.md                  # Описание продукта
│   ├── RULES.md                  # Правила разработки
│   └── ENVIRONMENT.md            # Этот файл
├── .env.local                    # Локальные переменные окружения (НЕ КОММИТИТЬ)
├── .env.example                  # Шаблон переменных окружения (можно коммитить)
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🗄️ Миграции Supabase

Все изменения схемы БД производятся через SQL-файлы в `supabase/migrations/`.

**Порядок работы:**
1. Создать файл `supabase/migrations/001_init_schema.sql`
2. Применить локально: `supabase db push`
3. Сгенерировать типы: `supabase gen types typescript --project-id <id> > lib/supabase/types.ts`

---

## ⚙️ Конфигурация Next.js

### `next.config.js` (минимальный)
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Оптимизация для Vercel
}

module.exports = nextConfig
```

### `tailwind.config.ts`
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Кастомные цвета, шрифты — будут определены после Impeccable
    },
  },
  plugins: [],
}

export default config
```
