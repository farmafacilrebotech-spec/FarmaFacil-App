-- =============================================================================
-- 042_pharmacy_home_entrypoint_v1.sql
-- QR oficial único por farmacia (public_entrypoints.purpose = pharmacy_home).
--
-- - public_id aleatorio, estable, no predecible (no usa el nombre).
-- - Alta: ff_create_pharmacy_v1 crea el entrypoint automáticamente.
-- - Backfill idempotente: no cambia public_id si ya existe pharmacy_home.
-- - Una sola URL pública canónica: /e/{public_id}
--
-- NO duplica 041 (kiosko solo LEE el entrypoint).
-- NO APLICAR automáticamente en producción.
-- Depende de: 009, 011, 030, 032, 041 (lectura kiosko).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Generador de public_id (alfabeto [a-z0-9], longitud 16)
-- -----------------------------------------------------------------------------
-- Entropía: pgcrypto.gen_random_bytes en el esquema REAL de la extensión
-- (en Supabase suele ser "extensions"; en otros entornos "public").
-- No se hardcodea el schema: se resuelve vía pg_extension.
-- Fallback: gen_random_uuid() (pg_catalog / PG13+) si pgcrypto no está.
CREATE OR REPLACE FUNCTION public.ff_generate_entrypoint_public_id_v1()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_alphabet text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  v_id text;
  v_i integer;
  v_byte integer;
  v_attempts integer := 0;
  v_rand bytea;
  v_pgcrypto_schema text;
BEGIN
  SELECT n.nspname
  INTO v_pgcrypto_schema
  FROM pg_catalog.pg_extension e
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto'
  ORDER BY
    CASE n.nspname
      WHEN 'extensions' THEN 0
      WHEN 'public' THEN 1
      ELSE 2
    END,
    n.nspname
  LIMIT 1;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 32 THEN
      RAISE EXCEPTION 'entrypoint_public_id_generation_failed'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pgcrypto_schema IS NOT NULL THEN
      EXECUTE format(
        'SELECT %I.gen_random_bytes(16)',
        v_pgcrypto_schema
      ) INTO v_rand;
    ELSE
      -- Fallback seguro sin pgcrypto (32 hex chars ≈ 16 bytes por UUID).
      v_rand := decode(
        replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', ''),
        'hex'
      );
    END IF;

    v_id := '';
    FOR v_i IN 0..15 LOOP
      v_byte := get_byte(v_rand, v_i);
      v_id := v_id || substr(v_alphabet, (v_byte % 36) + 1, 1);
    END LOOP;

    -- Debe empezar por [a-z0-9] (ya garantizado) y cumplir CHECK de 009.
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.public_entrypoints pe WHERE pe.public_id = v_id
    );
  END LOOP;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ff_generate_entrypoint_public_id_v1() IS
  'Genera public_id único URL-safe (16 chars [a-z0-9]). Resuelve pgcrypto vía pg_extension; no asume schema.';

REVOKE ALL ON FUNCTION public.ff_generate_entrypoint_public_id_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_generate_entrypoint_public_id_v1()
  TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Ensure pharmacy_home (idempotente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_ensure_pharmacy_home_entrypoint_v1(
  p_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_existing public.public_entrypoints%ROWTYPE;
  v_public_id text;
  v_route text;
  v_created boolean := false;
BEGIN
  IF p_pharmacy_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = p_pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Autorización:
  -- - authenticated: platform.pharmacies.write | entrypoints.manage
  -- - service_role / migrate (postgres): sin JWT
  IF v_uid IS NOT NULL THEN
    IF NOT (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_pharmacy_permission(p_pharmacy_id, 'entrypoints.manage')
    ) THEN
      RETURN jsonb_build_object('status', 'forbidden');
    END IF;
  ELSIF NOT (
    public.ff_is_service_role()
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT *
  INTO v_existing
  FROM public.public_entrypoints pe
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.purpose = 'pharmacy_home'
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'created', false,
      'entrypoint_id', v_existing.id,
      'pharmacy_id', v_existing.pharmacy_id,
      'public_id', v_existing.public_id,
      'internal_route', v_existing.internal_route,
      'is_active', v_existing.is_active,
      'qr_asset_path', v_existing.qr_asset_path,
      'qr_version', v_existing.qr_version
    );
  END IF;

  v_public_id := public.ff_generate_entrypoint_public_id_v1();
  v_route := '/e/' || v_public_id;

  INSERT INTO public.public_entrypoints (
    pharmacy_id,
    public_id,
    purpose,
    internal_route,
    is_active,
    qr_version,
    created_by,
    updated_by
  )
  VALUES (
    p_pharmacy_id,
    v_public_id,
    'pharmacy_home',
    v_route,
    true,
    1,
    v_uid,
    v_uid
  )
  RETURNING * INTO v_existing;

  v_created := true;

  RETURN jsonb_build_object(
    'status', 'ok',
    'created', v_created,
    'entrypoint_id', v_existing.id,
    'pharmacy_id', v_existing.pharmacy_id,
    'public_id', v_existing.public_id,
    'internal_route', v_existing.internal_route,
    'is_active', v_existing.is_active,
    'qr_asset_path', v_existing.qr_asset_path,
    'qr_version', v_existing.qr_version
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Carrera: otro proceso creó pharmacy_home; devolver el existente sin cambiar id.
    SELECT *
    INTO v_existing
    FROM public.public_entrypoints pe
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND pe.purpose = 'pharmacy_home';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;

    RETURN jsonb_build_object(
      'status', 'ok',
      'created', false,
      'entrypoint_id', v_existing.id,
      'pharmacy_id', v_existing.pharmacy_id,
      'public_id', v_existing.public_id,
      'internal_route', v_existing.internal_route,
      'is_active', v_existing.is_active,
      'qr_asset_path', v_existing.qr_asset_path,
      'qr_version', v_existing.qr_version
    );
END;
$$;

COMMENT ON FUNCTION public.ff_ensure_pharmacy_home_entrypoint_v1(uuid) IS
  'Idempotente: crea pharmacy_home si falta; si existe, no cambia public_id.';

REVOKE ALL ON FUNCTION public.ff_ensure_pharmacy_home_entrypoint_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_ensure_pharmacy_home_entrypoint_v1(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Backfill de todas las farmacias
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_backfill_pharmacy_home_entrypoints_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row record;
  v_result jsonb;
  v_created integer := 0;
  v_existing integer := 0;
  v_errors integer := 0;
BEGIN
  IF v_uid IS NOT NULL THEN
    IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
      RETURN jsonb_build_object('status', 'forbidden');
    END IF;
  ELSIF NOT (
    public.ff_is_service_role()
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  FOR v_row IN
    SELECT p.id
    FROM public.pharmacies p
    WHERE p.status IS DISTINCT FROM 'archived'
    ORDER BY p.created_at
  LOOP
    v_result := public.ff_ensure_pharmacy_home_entrypoint_v1(v_row.id);
    IF (v_result->>'status') = 'ok' THEN
      IF COALESCE((v_result->>'created')::boolean, false) THEN
        v_created := v_created + 1;
      ELSE
        v_existing := v_existing + 1;
      END IF;
    ELSE
      v_errors := v_errors + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'created', v_created,
    'already_present', v_existing,
    'errors', v_errors
  );
END;
$$;

COMMENT ON FUNCTION public.ff_backfill_pharmacy_home_entrypoints_v1() IS
  'Provisiona pharmacy_home en farmacias sin entrypoint. No regenera public_id existentes.';

REVOKE ALL ON FUNCTION public.ff_backfill_pharmacy_home_entrypoints_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_backfill_pharmacy_home_entrypoints_v1()
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Integrar en alta de farmacia (REPLACE 030 + entrypoint)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_create_pharmacy_v1(
  p_name text,
  p_plan_key text,
  p_legal_name text DEFAULT NULL,
  p_cif text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_web text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_country text DEFAULT 'ES',
  p_status text DEFAULT 'pending_setup',
  p_logo_color text DEFAULT NULL,
  p_primary_color text DEFAULT NULL,
  p_secondary_color text DEFAULT NULL,
  p_welcome_message text DEFAULT NULL,
  p_visible_name text DEFAULT NULL,
  p_schedule text DEFAULT NULL,
  p_settings_phone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_settings_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_plan_id uuid;
  v_pharmacy_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_ep jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'pharmacy_name_required'
      USING ERRCODE = '23514';
  END IF;

  IF p_plan_key IS NULL OR length(trim(p_plan_key)) = 0 THEN
    RAISE EXCEPTION 'plan_key_required'
      USING ERRCODE = '23514';
  END IF;

  SELECT p.id
    INTO v_plan_id
  FROM public.plans p
  WHERE p.key = trim(p_plan_key)
    AND p.is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_not_found_or_inactive: %', p_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plan_modules pm
    INNER JOIN public.modules m ON m.id = pm.module_id
    WHERE pm.plan_id = v_plan_id
      AND m.is_active = true
  ) THEN
    RAISE EXCEPTION 'plan_has_no_active_modules: %', p_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.pharmacies (
    name, legal_name, cif, email, phone, web, address_line, postal_code,
    city, province, country, status, plan_id, logo_color, created_by, updated_by
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(p_legal_name), ''),
    NULLIF(trim(p_cif), ''),
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_web), ''),
    NULLIF(trim(p_address_line), ''),
    NULLIF(trim(p_postal_code), ''),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_province), ''),
    COALESCE(NULLIF(trim(p_country), ''), 'ES'),
    COALESCE(NULLIF(trim(p_status), ''), 'pending_setup'),
    v_plan_id,
    NULLIF(trim(p_logo_color), ''),
    v_uid,
    v_uid
  )
  RETURNING id INTO v_pharmacy_id;

  INSERT INTO public.pharmacy_branding (
    pharmacy_id, primary_color, secondary_color, welcome_message, updated_by
  )
  VALUES (
    v_pharmacy_id,
    NULLIF(trim(p_primary_color), ''),
    NULLIF(trim(p_secondary_color), ''),
    NULLIF(trim(p_welcome_message), ''),
    v_uid
  );

  INSERT INTO public.pharmacy_settings (
    pharmacy_id, visible_name, schedule, phone, whatsapp, email, updated_by
  )
  VALUES (
    v_pharmacy_id,
    COALESCE(NULLIF(trim(p_visible_name), ''), trim(p_name)),
    NULLIF(trim(p_schedule), ''),
    COALESCE(NULLIF(trim(p_settings_phone), ''), NULLIF(trim(p_phone), '')),
    NULLIF(trim(p_whatsapp), ''),
    COALESCE(NULLIF(trim(p_settings_email), ''), NULLIF(trim(p_email), '')),
    v_uid
  );

  INSERT INTO public.subscriptions (
    pharmacy_id, plan_id, status, provider,
    trial_start, trial_end, current_period_start, current_period_end,
    created_by, updated_by
  )
  VALUES (
    v_pharmacy_id, v_plan_id, 'trialing', 'manual',
    v_now, v_now + interval '30 days', v_now, v_now + interval '30 days',
    v_uid, v_uid
  );

  INSERT INTO public.pharmacy_entitlements (
    pharmacy_id, module_id, status, source, source_plan_id,
    limits, config, starts_at, created_by, updated_by
  )
  SELECT
    v_pharmacy_id, pm.module_id, 'active', 'plan', v_plan_id,
    COALESCE(pm.default_limits, '{}'::jsonb), '{}'::jsonb,
    v_now, v_uid, v_uid
  FROM public.plan_modules pm
  INNER JOIN public.modules m ON m.id = pm.module_id
  WHERE pm.plan_id = v_plan_id
    AND m.is_active = true;

  -- 6) QR oficial (pharmacy_home). Fallo → aborta el alta (transacción).
  v_ep := public.ff_ensure_pharmacy_home_entrypoint_v1(v_pharmacy_id);
  IF (v_ep->>'status') IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION 'pharmacy_home_entrypoint_failed: %', coalesce(v_ep->>'status', 'unknown')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_pharmacy_id;
END;
$$;

COMMENT ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) IS
  'Alta atómica: farmacia + branding + settings + trial 30d + entitlements + pharmacy_home QR. SECURITY INVOKER (RLS). Misma firma que 030.';

-- Conservar grants de 030 (REPLACE suele preservarlos; se reafirman por claridad).
REVOKE ALL ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) Backfill al aplicar (idempotente; no toca public_id existentes)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- Durante migrate, suele ejecutarse como superuser/postgres (service).
  v_result := public.ff_backfill_pharmacy_home_entrypoints_v1();
  RAISE NOTICE '042 backfill pharmacy_home: %', v_result::text;
END;
$$;

-- =============================================================================
-- DOWN (manual):
-- -- Quitar solo la llamada a ensure de create_pharmacy (redeploy 030) si hace falta.
-- DROP FUNCTION IF EXISTS public.ff_backfill_pharmacy_home_entrypoints_v1();
-- DROP FUNCTION IF EXISTS public.ff_ensure_pharmacy_home_entrypoint_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_generate_entrypoint_public_id_v1();
-- -- NO borrar filas public_entrypoints en producción sin revisión.
-- =============================================================================
