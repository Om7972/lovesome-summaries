
ALTER TABLE public.insights_history
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Tighten public read policy: only valid (non-null token + not expired) shares are publicly readable
DROP POLICY IF EXISTS "Public can view shared insights via token" ON public.insights_history;

CREATE POLICY "Public can view shared insights via token"
ON public.insights_history
FOR SELECT
TO anon, authenticated
USING (
  share_token IS NOT NULL
  AND (expires_at IS NULL OR expires_at > now())
);
