-- 1. Drop the broad public SELECT policy so anon clients can no longer
--    discover share-link rows via PostgREST/GraphQL.
DROP POLICY IF EXISTS "Public can view shared insights via token" ON public.insights_history;

-- 2. Brute-force tracking table (no direct client access)
CREATE TABLE IF NOT EXISTS public.insight_share_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_isa_token_time
  ON public.insight_share_attempts (share_token, attempted_at DESC);

ALTER TABLE public.insight_share_attempts ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: only SECURITY DEFINER functions touch it.

-- 3. Metadata lookup (safe to call without password) — returns
--    only non-sensitive fields needed to render the lock screen.
CREATE OR REPLACE FUNCTION public.get_shared_insight_meta(_token text)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  tone text,
  length text,
  theme_count int,
  document_count int,
  expires_at timestamptz,
  has_password boolean,
  exists_flag boolean,
  expired boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN;
  END IF;
  SELECT h.id, h.created_at, h.tone, h.length, h.theme_count,
         h.document_count, h.expires_at, h.password_hash
    INTO r
    FROM public.insights_history h
   WHERE h.share_token = _token;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT
    r.id, r.created_at, r.tone, r.length, r.theme_count, r.document_count,
    r.expires_at,
    (r.password_hash IS NOT NULL) AS has_password,
    true AS exists_flag,
    (r.expires_at IS NOT NULL AND r.expires_at <= now()) AS expired;
END;
$$;

-- 4. Content lookup with rate-limited password verification.
--    Raises 'rate_limited' / 'invalid_password' / 'expired' / 'not_found'.
CREATE OR REPLACE FUNCTION public.get_shared_insight_content(
  _token text,
  _password_hash text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  tone text,
  length text,
  theme_count int,
  document_count int,
  source_ids jsonb,
  expires_at timestamptz
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pw_hash text;
  v_expires timestamptz;
  v_recent_failures int;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT h.password_hash, h.expires_at
    INTO v_pw_hash, v_expires
    FROM public.insights_history h
   WHERE h.share_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_expires IS NOT NULL AND v_expires <= now() THEN
    RAISE EXCEPTION 'expired';
  END IF;

  IF v_pw_hash IS NOT NULL THEN
    -- Rate limit: max 5 failures in any 15-minute window per token
    SELECT count(*) INTO v_recent_failures
      FROM public.insight_share_attempts a
     WHERE a.share_token = _token
       AND a.success = false
       AND a.attempted_at > now() - interval '15 minutes';
    IF v_recent_failures >= 5 THEN
      RAISE EXCEPTION 'rate_limited';
    END IF;

    IF _password_hash IS NULL OR _password_hash <> v_pw_hash THEN
      INSERT INTO public.insight_share_attempts (share_token, success)
        VALUES (_token, false);
      RAISE EXCEPTION 'invalid_password';
    END IF;
    INSERT INTO public.insight_share_attempts (share_token, success)
      VALUES (_token, true);
  END IF;

  RETURN QUERY
    SELECT h.id, h.content, h.created_at, h.tone, h.length, h.theme_count,
           h.document_count, h.source_ids, h.expires_at
      FROM public.insights_history h
     WHERE h.share_token = _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_insight_meta(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_insight_content(text, text) TO anon, authenticated;
