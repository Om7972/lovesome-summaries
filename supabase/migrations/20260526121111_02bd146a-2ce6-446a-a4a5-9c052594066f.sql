CREATE TABLE public.insight_share_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insights_history_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insight_share_events_history ON public.insight_share_events(insights_history_id, created_at DESC);

ALTER TABLE public.insight_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own share events"
  ON public.insight_share_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own share events"
  ON public.insight_share_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own share events"
  ON public.insight_share_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);