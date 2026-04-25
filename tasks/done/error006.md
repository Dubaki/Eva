ОШИБКА #7: bot_tasks_queue НЕ ИМЕЕТ ИНДЕКСА ДЛЯ БЫСТРОГО ПОИСКА PENDING ЗАДАЧ
Суть ошибки
Таблица bot_tasks_queue существует, но нет индекса для быстрого поиска задач с status='pending' и run_at <= NOW().
Если задач накопится 10,000+, каждый cron job'будет делать full table scan:
SELECT * FROM bot_tasks_queue WHERE status='pending' AND run_at <= NOW()
Это медленно и дорого.
Промт для исправления
SQL миграция (добавить индекс):

-- supabase/migrations/104_optimize_bot_tasks_queue.sql

-- Индекс для быстрого поиска pending задач по времени
CREATE INDEX idx_bot_tasks_queue_pending 
  ON bot_tasks_queue(run_at) 
  WHERE status = 'pending';

-- Индекс для поиска по tg_id (для удаления при удалении профиля)
CREATE INDEX idx_bot_tasks_queue_tg_id ON bot_tasks_queue(tg_id);

-- Индекс для поиска по profile_id
CREATE INDEX idx_bot_tasks_queue_profile_id ON bot_tasks_queue(profile_id);

Проверить в Edge Function или cron handler:

// Самый быстрый запрос:
const { data: tasks } = await supabaseAdmin
  .from('bot_tasks_queue')
  .select('*')
  .eq('status', 'pending')
  .lte('run_at', new Date().toISOString())
  .order('run_at', { ascending: true })
  .limit(100)  // Обработать батч из 100 задач за раз

// Благодаря индексу это будет быстро ⚡️

