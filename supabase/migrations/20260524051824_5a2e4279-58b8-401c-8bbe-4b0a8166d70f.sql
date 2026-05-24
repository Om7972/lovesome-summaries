
ALTER TABLE public.insights_history
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_insights_history_share_token
  ON public.insights_history(share_token)
  WHERE share_token IS NOT NULL;

-- Allow public (anon + authenticated) read access when a share token is set,
-- restricted to rows queried by that token.
DROP POLICY IF EXISTS "Public can view shared insights via token" ON public.insights_history;
CREATE POLICY "Public can view shared insights via token"
ON public.insights_history
FOR SELECT
TO anon, authenticated
USING (share_token IS NOT NULL);

-- Allow owners to set/clear their own share token
DROP POLICY IF EXISTS "Users can update own insights history" ON public.insights_history;
CREATE POLICY "Users can update own insights history"
ON public.insights_history
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
