-- Migration 104: Optimize bot_tasks_queue
-- Мы добавляем индексы для эффективной выборки задач, которые ожидают выполнения (pending).

BEGIN;

-- 1. Индекс для быстрого поиска pending задач по времени (частичный индекс)
-- Это позволит базе данных мгновенно находить задачи, у которых run_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_bot_tasks_queue_pending 
  ON bot_tasks_queue(run_at) 
  WHERE status = 'pending';

-- 2. Индекс для поиска по tg_id (полезно для аналитики и при удалении/обновлении)
CREATE INDEX IF NOT EXISTS idx_bot_tasks_queue_tg_id ON bot_tasks_queue(tg_id);

-- 3. Индекс для поиска по profile_id (ссылочная целостность)
CREATE INDEX IF NOT EXISTS idx_bot_tasks_queue_profile_id ON bot_tasks_queue(profile_id);

COMMIT;
