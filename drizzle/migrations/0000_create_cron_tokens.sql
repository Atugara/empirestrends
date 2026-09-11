CREATE TABLE IF NOT EXISTS public.cron_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'daily-run',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_tokens TO service_role;

ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the server (service role) may read these tokens.
