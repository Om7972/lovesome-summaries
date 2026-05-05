CREATE TABLE public.insights_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'balanced',
  length TEXT NOT NULL DEFAULT 'medium',
  theme_count INTEGER NOT NULL DEFAULT 5,
  document_count INTEGER NOT NULL DEFAULT 0,
  source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.insights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights history"
ON public.insights_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights history"
ON public.insights_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights history"
ON public.insights_history FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_insights_history_user_created ON public.insights_history(user_id, created_at DESC);