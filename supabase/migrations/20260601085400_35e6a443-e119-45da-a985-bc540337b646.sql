
CREATE TABLE public.transcript_cache (
  video_id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_score JSONB,
  source TEXT,
  duration_seconds INTEGER,
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transcript_cache TO anon;
GRANT SELECT ON public.transcript_cache TO authenticated;
GRANT ALL ON public.transcript_cache TO service_role;

ALTER TABLE public.transcript_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read transcript cache"
  ON public.transcript_cache
  FOR SELECT
  USING (true);

CREATE INDEX idx_transcript_cache_updated_at ON public.transcript_cache(updated_at DESC);
