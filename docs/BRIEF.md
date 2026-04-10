# BRIEF — EVA

> Telegram Mini App «Тест на искажённые опоры»
> Версия: 1.1 | Дата: 10.04.2026 | Статус: **System Integration, Retention & CRM**

---

## 📋 О продукте
**EVA** — Telegram Mini App (TMA), проводящее психологическую диагностику по 5 шкалам искажённых опор. Пользователь проходит тест, получает визуализированный результат (Доминирующая опора с ФОТО). Теневая (вторичная) опора открывается через реферальную воронку. Внедрена система возврата (Retention) через 60 дней и Панель Администратора.

---

## 🏗️ Архитектура (Обновлено)
### Стек
- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + RLS)
- **Background Jobs:** Supabase Edge Functions + pg_cron
- **Bot Logic:** Telegram Bot API (webhook) + Edge Functions

### Ключевая логика (Workflow)
1. **Сохранение результатов (СТРОГИЙ ПОРЯДОК):**
   - Приложение сначала обязано сделать `UPSERT` в таблицу `profiles` (чтобы избежать ошибки Foreign Key).
   - Только после этого делается `INSERT` в `test_results`.
2. **Система уведомлений (Edge Functions):**
   - `process-bot-notifications`: Срабатывает по вебхуку БД. Отправляет результат с ФОТО при новом `INSERT` в `test_results`. Отправляет смешанную опору (Теневую) при обновлении `invites_count` >= 2 в таблице `profiles`.
3. **Система возврата (Cooldown & Cron):**
   - **Frontend:** Блокировка кнопки "Пройти тест", если дата последней записи пользователя < 60 дней.
   - **Backend:** `pg_cron` раз в сутки вызывает Edge Function `send-periodic-reminders`. Функция ищет юзеров, у которых прошло 60 дней И колонка `reminded_at IS NULL`. После отправки напоминания колонка обновляется на `NOW()`.

---

## 📐 База данных (Актуальная схема)
- **`profiles`:** - `tg_id` (Primary Key)
  - `invites_count` (Счетчик рефералов)
  - `last_test_date` (Дата последнего теста для frontend-блокировки)
  - `reminded_at` (timestamptz, защита от спама Cron-напоминаний)
- **`test_results`:** - Foreign Key привязан к `profiles.tg_id`.
  - Хранит `primary_support` (одна буква) и `secondary_support` (одна буква).

---

## 🚀 Текущий статус (Апрель 2026)
- [x] **Phase 1-4:** Foundation, Design System, UI Development — ЗАВЕРШЕНО.
- [x] **Phase 5:** Auth API, Тестирование, Webhook Telegram — ЗАВЕРШЕНО.
- [x] **Phase 6a (Task 074/075):** Edge Function для уведомлений с фото и Теневых опор (Логика Смешанных опор) — ЗАВЕРШЕНО.
- [x] **Phase 6b (Task 076):** Внедрение `pg_cron` и защита `reminded_at` — ЗАВЕРШЕНО.
- [x] **Phase 7 (Task 077-096):** Авторизация и Синхронизация БД — ПОЛНОСТЬЮ ЗАВЕРШЕНО.
  - Реализована связка Telegram WebApp → Supabase с обходом RLS через `SUPABASE_SERVICE_ROLE_KEY`.
  - Прямое чтение `tg_id` из `window.Telegram.WebApp.initDataUnsafe.user.id` (без JWT).
  - RPC-функция `save_test_result` для атомарной записи профиля и результатов теста.
  - Lead capture: профиль создаётся при `/start`, `is_subscribed` обновляется при подтверждении подписки.
  - Cooldown 60 дней работает на уровне API + frontend gate.
  - Добавлено логирование на всех этапах: бот → API → БД → фронтенд.
- [x] **Phase 8 (Task 097-102):** Админ-панель — ПОЛНОСТЬЮ ЗАВЕРШЕНО.
  - **Вход:** по PIN-коду `2026` (через `localStorage.isAdmin` или тестировщики).
  - **CRM-система:** таблица всех пользователей с сортировкой (дата, рефералы, тест). Отдельная секция «Топ рефереры» с username (ссылка `t.me/`), TG ID и количеством приглашений.
  - **Личные сообщения:** кнопка «Написать» у каждого пользователя — модальное окно с отправкой через Telegram Bot API.
  - **Массовая рассылка (Broadcast):** отправка текста всем пользователям. Поддержка прикрепления фотографий с **автоматическим клиентским сжатием** (Canvas API): файлы >5MB ужимаются до ~500KB (max 1920px, quality 0.7).
  - **Дизайн:** Glassmorphism (`bg-white/70 backdrop-blur-md`), градиенты, motion-анимации, pill-style табы.
  - **Управление подарками:** редактирование ссылок на подарки по сферам через API `app_settings`.
- [ ] **Phase 9:** Retention & Cron — периодические напоминания, проверка работоспособности `pg_cron`.

---
