-- Migration 105: Setup bot_tasks_queue cron job
-- Мы настраиваем ежеминутный запуск обработчика очереди задач.
-- ВАЖНО: pg_cron должен быть включен в расширениях Supabase.

-- Если вы используете pg_cron, выполните этот запрос в SQL Editor,
-- подставив ваши актуальные SUPABASE_URL и SERVICE_ROLE_KEY.

/*
SELECT cron.schedule(
  'process-bot-queue', 
  '* * * * *', -- Каждую минуту
  $$
  SELECT net.http_post(
    url := 'https://[YOUR_PROJECT_ID].supabase.co/functions/v1/process-bot-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer [YOUR_SERVICE_ROLE_KEY]',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- Если pg_cron недоступен, рекомендуется использовать внешний планировщик 
-- (например, cron-job.org) для вызова URL функции каждую минуту.
