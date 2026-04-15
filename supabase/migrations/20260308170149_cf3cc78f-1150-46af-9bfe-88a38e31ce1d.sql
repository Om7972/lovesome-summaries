
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS key_points jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS insights jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS quotes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS tldr text DEFAULT '';
