
-- Quizzes table for AI Learning Mode
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid REFERENCES public.summaries(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  quiz_type text NOT NULL DEFAULT 'flashcard',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quizzes" ON public.quizzes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own quizzes" ON public.quizzes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_quizzes_summary_id ON public.quizzes(summary_id);
CREATE INDEX idx_quizzes_user_id ON public.quizzes(user_id);

-- Highlights table for Smart Highlight Detection
CREATE TABLE public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid REFERENCES public.summaries(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  timestamp text NOT NULL DEFAULT '',
  description text NOT NULL,
  importance text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own highlights" ON public.highlights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own highlights" ON public.highlights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own highlights" ON public.highlights FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_highlights_summary_id ON public.highlights(summary_id);

-- Podcasts table for AI Podcast Generator
CREATE TABLE public.podcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid REFERENCES public.summaries(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  audio_url text NOT NULL DEFAULT '',
  voice_type text NOT NULL DEFAULT 'alloy',
  duration_seconds integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own podcasts" ON public.podcasts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own podcasts" ON public.podcasts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own podcasts" ON public.podcasts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_podcasts_summary_id ON public.podcasts(summary_id);
