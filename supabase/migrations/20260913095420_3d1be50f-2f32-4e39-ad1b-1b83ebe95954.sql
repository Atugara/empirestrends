INSERT INTO public.cron_tokens (token, label)
SELECT encode(gen_random_bytes(32), 'hex'), 'daily-run'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cron_tokens WHERE label = 'daily-run'
);

SELECT cron.schedule(
  'trendjester-daily-pipeline',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := 'https://berrychukwubot.lovable.app/api/public/run-pipeline',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (
          SELECT token
          FROM public.cron_tokens
          WHERE label = 'daily-run'
          ORDER BY created_at DESC
          LIMIT 1
        )
      ),
      body := '{}'::jsonb
    );
  $$
);