CREATE TABLE IF NOT EXISTS public.channel_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  channel TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  account_label TEXT,
  last_checked_at TIMESTAMPTZ,
  last_check_ok BOOLEAN,
  last_check_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_credentials TO authenticated;
GRANT ALL ON public.channel_credentials TO service_role;

ALTER TABLE public.channel_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own channel credentials" ON public.channel_credentials;
CREATE POLICY "Users manage their own channel credentials"
  ON public.channel_credentials FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS channel_credentials_updated_at ON public.channel_credentials;
CREATE TRIGGER channel_credentials_updated_at
  BEFORE UPDATE ON public.channel_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();