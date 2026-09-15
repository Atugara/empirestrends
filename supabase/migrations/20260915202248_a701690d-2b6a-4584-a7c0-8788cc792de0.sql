ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_tokens FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.cron_tokens FROM anon;
REVOKE ALL ON public.cron_tokens FROM authenticated;
GRANT ALL ON public.cron_tokens TO service_role;

DROP POLICY IF EXISTS "No client access to cron tokens" ON public.cron_tokens;
CREATE POLICY "No client access to cron tokens"
ON public.cron_tokens
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);