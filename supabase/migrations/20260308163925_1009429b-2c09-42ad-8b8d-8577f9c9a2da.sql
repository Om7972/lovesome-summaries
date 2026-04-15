
-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at_desc ON public.summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_type ON public.summaries(type);
CREATE INDEX IF NOT EXISTS idx_summaries_user_created ON public.summaries(user_id, created_at DESC);

-- Add video_id column for YouTube caching
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS video_id text DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_summaries_video_id ON public.summaries(video_id) WHERE video_id IS NOT NULL;

-- Add summary_length and extracted_text_length columns
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS summary_length text DEFAULT 'medium';
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS extracted_text_length integer DEFAULT 0;
