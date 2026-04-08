<context>
Арбитр вынес вердикт: ПРИНЯТО С ПРАВКАМИ. Стек: монолитный Next.js 14 (App Router) + Supabase (Auth/DB/RLS) + TailwindCSS. Бот-логика реализуется через вебхуки внутри Next.js. Фундамент заложен. Необходимо создать базовые файлы конфигурации и запустить процесс проектирования дизайн-контекста (Impeccable).
</context>

<task>
1. Ознакомься с БЛОКОМ АРБИТРА в файле docs/COUNCIL.md.
2. Создай файл docs/BRIEF.md. Опиши в нем: Telegram Mini App "EVA", цель (WOW-эффект, реферальная воронка), архитектуру (единый деплой Next.js, отказ от Python) и текущий статус (Foundation Set).
3. Создай файл docs/RULES.md. Зафиксируй стек (Next.js 14 App Router, Supabase JS Client, Tailwind). Опиши строгие табу: 
   - Запрет на хардкод секретов.
   - Обязательная валидация initData по HMAC-SHA256 для всех API-роутов.
   - Все БД-запросы с клиента только через RLS (пользователь видит только свои данные).
4. Создай файл docs/ENVIRONMENT.md. Опиши переменные окружения (.env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, TELEGRAM_BOT_TOKEN. Укажи базовую структуру папок (app/, components/, lib/, supabase/migrations/).
5. Запусти команду `/teach-impeccable`. Задай Заказчику вопросы о визуальном стиле, бренде и аудитории EVA, чтобы сформировать файл .impeccable.md.
6. После создания файлов и завершения диалога по дизайну, перемести этот файл в tasks/done/.
</task>

<rules>
- Данные для файлов бери СТРОГО из БЛОКА АРБИТРА. Не придумывай новые сущности.
- Структурируй markdown-файлы четко (заголовки, списки).
- Диалог `/teach-impeccable` должен быть сфокусирован на премиальном мобильном UX.
- Файл docs/BOOT.md не изменять.
</rules>