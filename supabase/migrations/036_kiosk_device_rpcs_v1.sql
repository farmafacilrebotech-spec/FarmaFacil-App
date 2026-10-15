-- =============================================================================
-- 036_kiosk_device_rpcs_v1.sql
-- RPCs kiosko: consume (atómico + rate-limit + entitlement), validate, revoke.
--
-- Estados de sesión (validate):
--   valid              — operable + módulo kiosk + sesión activa
--   revoked            — dispositivo o sesión revocados / hash inválido / expirada
--   commercially_blocked — farmacia no operable o sin entitlement kiosk
--                        (sesión intacta; acceso se restablece si recupera derecho)
--
-- Emparejamiento: mensajes de fallo homogéneos hacia el cliente (no enumeración).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: farmacia puede operar kiosko ahora
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_pharmacy_runtime_allowed(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND public.ff_pharmacy_is_operable(p_pharmacy_id)
    AND public.ff_pharmacy_has_module(p_pharmacy_id, 'kiosk');
$$;

COMMENT ON FUNCTION public.ff_kiosk_pharmacy_runtime_allowed(uuid) IS
  'true si la farmacia está operable y tiene entitlement activo del módulo kiosk.';

REVOKE ALL ON FUNCTION public.ff_kiosk_pharmacy_runtime_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_pharmacy_runtime_allowed(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Rate-limit interno (solo DEFINER)
-- -----------------------------------------------------------------------------
-- Ventana 15 min, máx. 8 intentos fallidos, bloqueo 15 min.
-- bucket_key = sha256-hex de huella de cliente (IP) que envía el servidor.

CREATE OR REPLACE FUNCTION public.ff_kiosk_pairing_rate_check_v1(p_bucket_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_window interval := interval '15 minutes';
  v_max_attempts integer := 8;
  v_block interval := interval '15 minutes';
  v_row public.kiosk_pairing_rate_limits%ROWTYPE;
BEGIN
  IF p_bucket_key IS NULL OR length(btrim(p_bucket_key)) < 16 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'bad_bucket');
  END IF;

  INSERT INTO public.kiosk_pairing_rate_limits (bucket_key, window_started_at, attempt_count)
  VALUES (btrim(p_bucket_key), v_now, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.kiosk_pairing_rate_limits
  WHERE bucket_key = btrim(p_bucket_key)
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', greatest(1, extract(epoch FROM (v_row.blocked_until - v_now))::integer)
    );
  END IF;

  -- Ventana caducada → reset
  IF v_row.window_started_at + v_window < v_now THEN
    UPDATE public.kiosk_pairing_rate_limits
    SET window_started_at = v_now,
        attempt_count = 0,
        blocked_until = NULL,
        updated_at = v_now
    WHERE bucket_key = v_row.bucket_key;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ff_kiosk_pairing_rate_fail_v1(p_bucket_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_max_attempts integer := 8;
  v_block interval := interval '15 minutes';
  v_count integer;
BEGIN
  IF p_bucket_key IS NULL OR length(btrim(p_bucket_key)) < 16 THEN
    RETURN;
  END IF;

  INSERT INTO public.kiosk_pairing_rate_limits (bucket_key, window_started_at, attempt_count)
  VALUES (btrim(p_bucket_key), v_now, 1)
  ON CONFLICT (bucket_key) DO UPDATE
  SET attempt_count = public.kiosk_pairing_rate_limits.attempt_count + 1,
      updated_at = v_now
  RETURNING attempt_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT attempt_count INTO v_count
    FROM public.kiosk_pairing_rate_limits
    WHERE bucket_key = btrim(p_bucket_key);
  END IF;

  IF COALESCE(v_count, 0) >= v_max_attempts THEN
    UPDATE public.kiosk_pairing_rate_limits
    SET blocked_until = v_now + v_block,
        updated_at = v_now
    WHERE bucket_key = btrim(p_bucket_key);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_pairing_rate_check_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_kiosk_pairing_rate_fail_v1(text) FROM PUBLIC;
-- Solo service_role / owner; el consume DEFINER las llama internamente.
GRANT EXECUTE ON FUNCTION public.ff_kiosk_pairing_rate_check_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_pairing_rate_fail_v1(text) TO service_role;

-- -----------------------------------------------------------------------------
-- Consume pairing (atómico + rate-limit + entitlement)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_consume_pairing_code_v1(
  p_code_hash text,
  p_credential_hash text,
  p_display_name text DEFAULT 'Tablet kiosko',
  p_user_agent text DEFAULT NULL,
  p_session_ttl_days integer DEFAULT 90,
  p_client_bucket_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_code public.pharmacy_device_pairing_codes%ROWTYPE;
  v_device_id uuid;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_name text;
  v_rate jsonb;
BEGIN
  IF p_code_hash IS NULL OR length(btrim(p_code_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'code_unavailable');
  END IF;
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'code_unavailable');
  END IF;

  -- Rate-limit antes de tocar códigos (anti-enumeración / fuerza bruta).
  IF p_client_bucket_key IS NOT NULL THEN
    v_rate := public.ff_kiosk_pairing_rate_check_v1(p_client_bucket_key);
    IF COALESCE((v_rate->>'allowed')::boolean, false) IS NOT TRUE THEN
      -- Mismo status externo que código inválido (sin filtrar existencia).
      RETURN jsonb_build_object('status', 'code_unavailable');
    END IF;
  END IF;

  SELECT *
  INTO v_code
  FROM public.pharmacy_device_pairing_codes
  WHERE code_hash = btrim(p_code_hash)
    AND consumed_at IS NULL
    AND expires_at > pg_catalog.now()
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    IF p_client_bucket_key IS NOT NULL THEN
      PERFORM public.ff_kiosk_pairing_rate_fail_v1(p_client_bucket_key);
    END IF;
    RETURN jsonb_build_object('status', 'code_unavailable');
  END IF;

  -- Entitlement en el momento del canje (no basta con haber generado el código).
  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_code.pharmacy_id) THEN
    IF p_client_bucket_key IS NOT NULL THEN
      PERFORM public.ff_kiosk_pairing_rate_fail_v1(p_client_bucket_key);
    END IF;
    -- No consumir el código: si recupera derecho, el código puede seguir vigente.
    RETURN jsonb_build_object('status', 'code_unavailable');
  END IF;

  v_name := nullif(btrim(COALESCE(p_display_name, '')), '');
  IF v_name IS NULL THEN
    v_name := 'Tablet kiosko';
  END IF;

  INSERT INTO public.pharmacy_devices (
    pharmacy_id,
    display_name,
    status,
    paired_at,
    user_agent,
    last_seen_at
  )
  VALUES (
    v_code.pharmacy_id,
    v_name,
    'active',
    pg_catalog.now(),
    nullif(btrim(COALESCE(p_user_agent, '')), ''),
    pg_catalog.now()
  )
  RETURNING id INTO v_device_id;

  v_expires_at := pg_catalog.now() + make_interval(days => greatest(1, COALESCE(p_session_ttl_days, 90)));

  INSERT INTO public.pharmacy_device_sessions (
    device_id,
    pharmacy_id,
    credential_hash,
    expires_at,
    last_seen_at
  )
  VALUES (
    v_device_id,
    v_code.pharmacy_id,
    btrim(p_credential_hash),
    v_expires_at,
    pg_catalog.now()
  )
  RETURNING id INTO v_session_id;

  UPDATE public.pharmacy_device_pairing_codes
  SET
    consumed_at = pg_catalog.now(),
    consumed_by_device_id = v_device_id
  WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'device_id', v_device_id,
    'session_id', v_session_id,
    'pharmacy_id', v_code.pharmacy_id,
    'expires_at', v_expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_consume_pairing_code_v1(text, text, text, text, integer, text) IS
  'Canje atómico + rate-limit + operable/módulo. Fallos → status code_unavailable (sin enumeración).';

REVOKE ALL ON FUNCTION public.ff_kiosk_consume_pairing_code_v1(text, text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_consume_pairing_code_v1(text, text, text, text, integer, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Validate session
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_validate_device_session_v1(
  p_credential_hash text,
  p_touch_last_seen boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
BEGIN
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  SELECT *
  INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = btrim(p_credential_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  SELECT *
  INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  -- Comercial / entitlement: sesión intacta, acceso bloqueado temporalmente.
  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_session.pharmacy_id) THEN
    RETURN jsonb_build_object(
      'status', 'commercially_blocked',
      'device_id', v_device.id,
      'pharmacy_id', v_session.pharmacy_id,
      'session_id', v_session.id
    );
  END IF;

  IF COALESCE(p_touch_last_seen, true) THEN
    UPDATE public.pharmacy_device_sessions
    SET last_seen_at = pg_catalog.now()
    WHERE id = v_session.id;

    UPDATE public.pharmacy_devices
    SET last_seen_at = pg_catalog.now()
    WHERE id = v_device.id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'device_id', v_device.id,
    'pharmacy_id', v_session.pharmacy_id,
    'session_id', v_session.id,
    'display_name', v_device.display_name,
    'expires_at', v_session.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_validate_device_session_v1(text, boolean) IS
  'Valida cookie de dispositivo. Distingue revoked vs commercially_blocked.';

REVOKE ALL ON FUNCTION public.ff_kiosk_validate_device_session_v1(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_validate_device_session_v1(text, boolean)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Revoke device (todas las sesiones)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_revoke_device_v1(
  p_device_id uuid,
  p_pharmacy_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_device public.pharmacy_devices%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF p_device_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_device
  FROM public.pharmacy_devices
  WHERE id = p_device_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Aislamiento de tenant: si se indica farmacia, debe coincidir.
  IF p_pharmacy_id IS NOT NULL
     AND v_device.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(v_device.pharmacy_id, 'kiosk.devices.manage')
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_device.status = 'revoked' THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'device_id', v_device.id,
      'already_revoked', true
    );
  END IF;

  UPDATE public.pharmacy_devices
  SET
    status = 'revoked',
    revoked_at = pg_catalog.now(),
    revoked_by = v_uid
  WHERE id = v_device.id;

  UPDATE public.pharmacy_device_sessions
  SET revoked_at = pg_catalog.now()
  WHERE device_id = v_device.id
    AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'status', 'ok',
    'device_id', v_device.id,
    'already_revoked', false
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_revoke_device_v1(uuid, uuid) IS
  'Revoca dispositivo y todas sus sesiones. Requiere kiosk.devices.manage o SuperAdmin.';

REVOKE ALL ON FUNCTION public.ff_kiosk_revoke_device_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_revoke_device_v1(uuid, uuid)
  TO authenticated, service_role;

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_kiosk_revoke_device_v1(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_validate_device_session_v1(text, boolean);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_consume_pairing_code_v1(text, text, text, text, integer, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_pairing_rate_fail_v1(text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_pairing_rate_check_v1(text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_pharmacy_runtime_allowed(uuid);
