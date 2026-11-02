-- Runs the daily-jobs function every morning at 8:00 India time (02:30 UTC).
-- Not a migration: replace the two placeholders with this project's URL and anon key, then run it once.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'woofabode-daily-jobs',
  '30 2 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR-ANON-KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
