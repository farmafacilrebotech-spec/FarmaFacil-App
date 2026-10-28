-- =============================================================================
-- 063_public_qr_quote_rate_limit_v1.sql  (BORRADOR)
-- Rate-limit compartido para get/decide de presupuesto público (R4).
-- Misma idea que kiosk_pairing_rate_limits: tabla + SECURITY DEFINER.
-- Sin Redis ni servicios de pago; durable entre instancias (Vercel/serverless).
--
-- Depende de: 062 (R4). NO APLICAR en producción sin autorización.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_order_quote_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_order_quote_rate_limits_count_chk CHECK (attempt_count >= 0),
  CONSTRAINT pharmacy_order_quote_rate_limits_key_chk CHECK (
    bucket_key ~ '^[a-f0-9]{32,128}$'
  )
);

COMMENT ON TABLE public.pharmacy_order_quote_rate_limits IS
  'Contadores R4 /q get+decide por huella cliente (sha256). Compartido entre instancias.';

ALTER TABLE public.pharmacy_order_quote_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pharmacy_order_quote_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pharmacy_order_quote_rate_limits TO service_role;

-- Ventana 15 min, máx. 40 intentos, bloqueo 15 min (espejo TS).
CREATE OR REPLACE FUNCTION public.ff_public_qr_quote_rate_allow_v1(p_bucket_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_window interval := interval '15 minutes';
  v_max_attempts integer := 40;
  v_block interval := interval '15 minutes';
  v_key text := lower(btrim(COALESCE(p_bucket_key, '')));
  v_row public.pharmacy_order_quote_rate_limits%ROWTYPE;
  v_count integer;
BEGIN
  IF v_key IS NULL OR length(v_key) < 32 OR v_key !~ '^[a-f0-9]+$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'bad_bucket');
  END IF;

  INSERT INTO public.pharmacy_order_quote_rate_limits (
    bucket_key, window_started_at, attempt_count, blocked_until, updated_at
  )
  VALUES (v_key, v_now, 0, NULL, v_now)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.pharmacy_order_quote_rate_limits
  WHERE bucket_key = v_key
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds',
        greatest(1, extract(epoch FROM (v_row.blocked_until - v_now))::integer)
    );
  END IF;

  IF v_row.window_started_at + v_window < v_now THEN
    UPDATE public.pharmacy_order_quote_rate_limits
    SET
      window_started_at = v_now,
      attempt_count = 1,
      blocked_until = NULL,
      updated_at = v_now
    WHERE bucket_key = v_key;
    RETURN jsonb_build_object('allowed', true, 'attempt_count', 1);
  END IF;

  v_count := COALESCE(v_row.attempt_count, 0) + 1;

  IF v_count > v_max_attempts THEN
    UPDATE public.pharmacy_order_quote_rate_limits
    SET
      attempt_count = v_count,
      blocked_until = v_now + v_block,
      updated_at = v_now
    WHERE bucket_key = v_key;
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', extract(epoch FROM v_block)::integer
    );
  END IF;

  UPDATE public.pharmacy_order_quote_rate_limits
  SET
    attempt_count = v_count,
    blocked_until = CASE
      WHEN v_count >= v_max_attempts THEN v_now + v_block
      ELSE NULL
    END,
    updated_at = v_now
  WHERE bucket_key = v_key;

  IF v_count >= v_max_attempts THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', extract(epoch FROM v_block)::integer
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'attempt_count', v_count);
END;
$$;

COMMENT ON FUNCTION public.ff_public_qr_quote_rate_allow_v1(text) IS
  'Rate-limit atómico R4. bucket_key = sha256 hex de huella (IP+UA). Sin PII.';

REVOKE ALL ON FUNCTION public.ff_public_qr_quote_rate_allow_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_public_qr_quote_rate_allow_v1(text)
  TO anon, authenticated, service_role;

-- Limpieza de buckets antiguos (ventanas/bloqueos ya irrelevantes).
CREATE OR REPLACE FUNCTION public.ff_public_qr_quote_rate_cleanup_v1(
  p_older_than interval DEFAULT interval '24 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.pharmacy_order_quote_rate_limits
  WHERE updated_at < pg_catalog.now() - p_older_than
    AND (blocked_until IS NULL OR blocked_until < pg_catalog.now());
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.ff_public_qr_quote_rate_cleanup_v1(interval) IS
  'Borra buckets de rate-limit R4 inactivos (>24h por defecto). Solo service_role.';

REVOKE ALL ON FUNCTION public.ff_public_qr_quote_rate_cleanup_v1(interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ff_public_qr_quote_rate_cleanup_v1(interval)
  TO service_role;
