ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS video_status text NOT NULL DEFAULT 'none';
