ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE TABLE public.post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  channel draft_channel NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draft_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_metrics TO authenticated;
GRANT ALL ON public.post_metrics TO service_role;

ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own post metrics" ON public.post_metrics
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX post_metrics_user_idx ON public.post_metrics (user_id, fetched_at DESC);