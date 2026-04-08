# BRIEF — EVA

> Telegram Mini App «Тест на искажённые опоры»
> Версия: 1.0 | Дата: 08.04.2026 | Статус: **UI/UX Development**

---

## 📋 О продукте

**EVA** — Telegram Mini App (TMA), проводящее психологическую диагностику по 5 шкалам искажённых опор. Пользователь проходит тест из 25 вопросов, получает визуализированный результат с доминирующей и вторичной опорой, и прогревается к покупке платных продуктов через квалификационный опрос и реферальную воронку.

---

## 🎯 Цели

1. **WOW-эффект:** Премиальный, плавный, анимированный UX, вызывающий доверие и желание поделиться.
2. **Реферальная воронка:** Расширенный результат (вторая опора) открывается за приглашение 2 друзей.
3. **Квалификация лидов:** После теста — 3 вопроса для передачи прогретого лида в продажу.

---

## 🏗️ Архитектура

### Стек
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + Framer Motion
- **Database / Auth:** Supabase (PostgreSQL + RLS)
- **Bot Logic:** Next.js API Route (`/api/webhook/telegram`)
- **UI Quality:** Impeccable Skill (Дизайн-система заложена в `.impeccable.md`)

---

## 🚀 Текущий статус

- [x] **Phase 1: Foundation** — Архитектурный аудит и вердикт Арбитра завершены (08.04.2026).
- [x] **Phase 2: Scaffolding** — Next.js 14 инициализирован, зависимости установлены.
- [x] **Phase 3: Design System** — Файл `.impeccable.md` создан (Минимализм, Фиолетовый акцент #6C5CE7).
- [x] **Phase 4a: Welcome Screen** — Реализован (`app/page.tsx`), анимации Framer Motion, адаптивные CSS-переменные TMA (08.04.2026).
- [x] **Phase 4b: Test Screen** — Реализован (`app/test/page.tsx`), Hero cross-fade, 5 кнопок ответа, прогресс-бар (08.04.2026).
- [x] **Phase 4c: UI Development** — Завершено.
- [x] **Phase 5a: Auth API** — `POST /api/auth` готов: HMAC-SHA256 initData, upsert profiles, Supabase JWT (08.04.2026).
- [x] **Phase 5b: Logic & Backend** — `/api/test/submit` + scoring + страница результата (08.04.2026).
- [x] **Phase 5c: Bug Fixes** — Кнопка "5" контрастна, квалификация работает, вторичная опора скрыта (08.04.2026).
- [x] **Phase 5d: Hero Images & Referral** — Картинки без обрезки, share работает (navigator.share → Telegram → clipboard) (08.04.2026).
- [x] **Phase 5e: Telegram Webhook** — `/start` с рефералами, inline кнопка TMA, валидация секрет-токена (08.04.2026).
- [x] **Phase 5f: Deployment** — Скрипт `set-webhook.js` для регистрации webhook, инструкция по деплою (08.04.2026).
- [ ] **Phase 6: Referral System** — В процессе.

---

## 📝 Ближайшие шаги (Backlog)

1. ~~**[Task 004]** Реализация Welcome Screen~~ — **ВЫПОЛНЕНО**
2. ~~**[Task 005b]** Test Screen UI~~ — **ВЫПОЛНЕНО**
3. ~~**[Task 006]** Настройка Supabase: миграции, RLS, клиент~~ — **ВЫПОЛНЕНО**
4. ~~**[Task 007]** Реализация `/api/auth`~~ — **ВЫПОЛНЕНО**
5. ~~**[Task 008]** Логика подсчета баллов и экран результатов~~ — **ВЫПОЛНЕНО**
6. ~~**[Task 010]** Фиксы UI: контраст кнопок, квалификация, скрытие опоры~~ — **ВЫПОЛНЕНО**

---

## 📐 База данных (Утверждено)
Таблицы: `profiles`, `qualifications`, `test_results`, `referrals`, `referral_log`.
Миграции: `supabase/migrations/001_init_schema.sql` — готовы к деплою (`supabase db push`).
RLS: включён на всех таблицах. Политики для SELECT/INSERT/UPDATE через `auth.uid()`.
Клиенты: `lib/supabase/client.ts` (anon, браузер), `lib/supabase/server.ts` (service_role, API).
Типы: `lib/supabase/types.ts` — полная типизация Database.