ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS topics_user_published_idx ON public.topics (user_id, published_at DESC);