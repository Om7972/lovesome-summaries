
CREATE TABLE public.content_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary_id UUID NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.content_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content outputs" ON public.content_outputs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content outputs" ON public.content_outputs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own content outputs" ON public.content_outputs FOR DELETE TO authenticated USING (auth.uid() = user_id);
