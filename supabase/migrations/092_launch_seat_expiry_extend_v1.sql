-- =============================================================================
-- 092_launch_seat_expiry_extend_v1.sql
-- Caducidad / ampliación de plazas launch_2027.
--
-- - expires_at obligatorio en NUEVAS reservas (no backfill silencioso)
-- - status expired + eventos extended / expired / expiry_notice_*
-- - ampliar / caducar solo SA (platform.subscriptions.manage)
-- - NO modifica piloto, plan operativo ni suscripción
-- - Avisos 5d / 2d / 0d: función de lectura (sin envío de email)
--
-- Prerrequisitos: 084, 089.
-- SOLO staging. NO producción.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.commercial_launch_seat_reservations') IS NULL THEN
    RAISE EXCEPTION '092 requires commercial_launch_seat_reservations (084)';
  END IF;
  IF to_regclass('public.commercial_launch_seat_events') IS NULL THEN
    RAISE EXCEPTION '092 requires commercial_launch_seat_events (089)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Config duración por defecto (días naturales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_launch_seat_settings (
  cohort_key text PRIMARY KEY
    REFERENCES public.commercial_launch_cohort_counters (cohort_key),
  default_ttl_days integer NOT NULL DEFAULT 15
    CHECK (default_ttl_days > 0 AND default_ttl_days <= 365),
  notices_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

INSERT INTO public.commercial_launch_seat_settings (cohort_key, default_ttl_days, notices_enabled)
VALUES ('launch_2027', 15, false)
ON CONFLICT (cohort_key) DO NOTHING;

COMMENT ON TABLE public.commercial_launch_seat_settings IS
  '092: TTL y flags de avisos de caducidad. notices_enabled=false → sin emails automáticos.';

ALTER TABLE public.commercial_launch_seat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_launch_seat_settings_select
  ON public.commercial_launch_seat_settings;
CREATE POLICY commercial_launch_seat_settings_select
  ON public.commercial_launch_seat_settings
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
  );

DROP POLICY IF EXISTS commercial_launch_seat_settings_write
  ON public.commercial_launch_seat_settings;
CREATE POLICY commercial_launch_seat_settings_write
  ON public.commercial_launch_seat_settings
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.subscriptions.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.subscriptions.manage'));

GRANT SELECT ON public.commercial_launch_seat_settings TO authenticated;
GRANT INSERT, UPDATE ON public.commercial_launch_seat_settings TO authenticated;

-- -----------------------------------------------------------------------------
-- Columnas reserva
-- -----------------------------------------------------------------------------
ALTER TABLE public.commercial_launch_seat_reservations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS extended_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS extended_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extension_reason text NULL,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reserved_by_kind text NULL
    CHECK (
      reserved_by_kind IS NULL
      OR reserved_by_kind = ANY (ARRAY['superadmin'::text, 'holder'::text, 'system'::text])
    );

COMMENT ON COLUMN public.commercial_launch_seat_reservations.expires_at IS
  '092: caducidad de reserva no confirmada. NULL en filas legacy pendientes de revisión manual.';

-- Ampliar CHECK de status: active | released | expired
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT c.conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'commercial_launch_seat_reservations'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';
  IF v_con IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.commercial_launch_seat_reservations DROP CONSTRAINT %I',
      v_con
    );
  END IF;
END $$;

ALTER TABLE public.commercial_launch_seat_reservations
  ADD CONSTRAINT commercial_launch_seat_reservations_status_chk
  CHECK (status = ANY (ARRAY['active'::text, 'released'::text, 'expired'::text]));

-- Índice: una activa por farmacia (sin expired/released)
DROP INDEX IF EXISTS commercial_launch_seat_one_active_per_pharmacy;
CREATE UNIQUE INDEX commercial_launch_seat_one_active_per_pharmacy
  ON public.commercial_launch_seat_reservations (cohort_key, pharmacy_id)
  WHERE status = 'active';

-- Event types: ampliar CHECK
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT c.conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'commercial_launch_seat_events'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%event_type%';
  IF v_con IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.commercial_launch_seat_events DROP CONSTRAINT %I',
      v_con
    );
  END IF;
END $$;

ALTER TABLE public.commercial_launch_seat_events
  ADD CONSTRAINT commercial_launch_seat_events_type_chk
  CHECK (
    event_type = ANY (
      ARRAY[
        'reserved'::text,
        're_reserved'::text,
        'released'::text,
        'confirmed'::text,
        'release_blocked'::text,
        'extended'::text,
        'expired'::text,
        'expiry_notice_5d'::text,
        'expiry_notice_2d'::text,
        'expiry_notice_0d'::text,
        'holder_reserved'::text,
        'contract_request'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.ff_launch_seat_default_ttl_days_v1(
  p_cohort_key text DEFAULT 'launch_2027'
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    (SELECT s.default_ttl_days
     FROM public.commercial_launch_seat_settings s
     WHERE s.cohort_key = p_cohort_key),
    15
  );
$$;

REVOKE ALL ON FUNCTION public.ff_launch_seat_default_ttl_days_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_launch_seat_default_ttl_days_v1(text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Reserva SA (redefine 089): fija expires_at; no toca piloto/plan/sub
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_reserve_launch_2027_seat_v1(
  p_pharmacy_id uuid,
  p_commercial_sku_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_sku text := lower(btrim(coalesce(p_commercial_sku_key, '')));
  v_list integer;
  v_promo integer;
  v_max integer;
  v_used integer;
  v_existing public.commercial_launch_seat_reservations%ROWTYPE;
  v_id uuid;
  v_event text;
  v_ttl integer := public.ff_launch_seat_default_ttl_days_v1('launch_2027');
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.subscriptions.manage') THEN
    RAISE EXCEPTION 'forbidden_subscriptions_manage' USING ERRCODE = '42501';
  END IF;

  v_list := public.ff_list_monthly_cents_v1(v_sku);
  v_promo := public.ff_launch_promo_cents_v1(v_sku);
  IF v_list IS NULL OR v_promo IS NULL THEN
    RAISE EXCEPTION 'launch_promo_invalid_sku'
      USING MESSAGE = 'SKU no elegible para promoción de lanzamiento.';
  END IF;

  v_expires := (v_now::date + v_ttl) + time '23:59:59';

  SELECT max_slots, used_slots
  INTO v_max, v_used
  FROM public.commercial_launch_cohort_counters
  WHERE cohort_key = 'launch_2027'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'launch_cohort_missing';
  END IF;

  SELECT * INTO v_existing
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
  FOR UPDATE;

  IF FOUND AND v_existing.status = 'active' THEN
    IF v_existing.confirmed_at IS NOT NULL OR v_existing.commitment_kind IS NOT NULL THEN
      RAISE EXCEPTION 'launch_seat_already_confirmed'
        USING MESSAGE = 'La plaza ya está confirmada; no se modifica por reserva ordinaria.';
    END IF;
    -- Idempotente: actualiza SKU; no reinicia caducidad si ya había expires_at
    UPDATE public.commercial_launch_seat_reservations
    SET commercial_sku_key = v_sku,
        list_monthly_cents = v_list,
        promo_monthly_cents = v_promo,
        expires_at = coalesce(expires_at, v_expires),
        updated_at = v_now
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'reservation_id', v_existing.id,
      'pharmacy_id', p_pharmacy_id,
      'expires_at', coalesce(v_existing.expires_at, v_expires),
      'slots_remaining', GREATEST(v_max - v_used, 0),
      'list_monthly_cents', v_list,
      'promo_monthly_cents', v_promo
    );
  END IF;

  IF v_used >= v_max THEN
    RAISE EXCEPTION 'launch_slots_exhausted'
      USING MESSAGE = 'No quedan plazas de lanzamiento 2027 (máx. 20).';
  END IF;

  IF FOUND AND v_existing.status IN ('released', 'expired') THEN
    UPDATE public.commercial_launch_seat_reservations
    SET status = 'active',
        commercial_sku_key = v_sku,
        list_monthly_cents = v_list,
        promo_monthly_cents = v_promo,
        reserved_at = v_now,
        reserved_by = v_uid,
        reserved_by_kind = 'superadmin',
        released_at = NULL,
        release_reason = NULL,
        expired_at = NULL,
        expires_at = v_expires,
        extended_at = NULL,
        extended_by = NULL,
        extension_reason = NULL,
        confirmed_at = NULL,
        confirmed_by = NULL,
        commitment_kind = NULL,
        commitment_notes = NULL,
        updated_at = v_now
    WHERE id = v_existing.id
    RETURNING id INTO v_id;
    v_event := 're_reserved';
  ELSE
    INSERT INTO public.commercial_launch_seat_reservations (
      cohort_key, pharmacy_id, commercial_sku_key,
      list_monthly_cents, promo_monthly_cents, status,
      reserved_at, reserved_by, reserved_by_kind, expires_at
    ) VALUES (
      'launch_2027', p_pharmacy_id, v_sku,
      v_list, v_promo, 'active',
      v_now, v_uid, 'superadmin', v_expires
    )
    RETURNING id INTO v_id;
    v_event := 'reserved';
  END IF;

  UPDATE public.commercial_launch_cohort_counters
  SET used_slots = used_slots + 1,
      updated_at = v_now
  WHERE cohort_key = 'launch_2027';

  INSERT INTO public.commercial_launch_seat_events (
    cohort_key, pharmacy_id, reservation_id, event_type, actor_id,
    commercial_sku_key, list_monthly_cents, promo_monthly_cents,
    metadata
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_id, v_event, v_uid,
    v_sku, v_list, v_promo,
    jsonb_build_object('expires_at', v_expires, 'ttl_days', v_ttl)
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'reservation_id', v_id,
    'pharmacy_id', p_pharmacy_id,
    'expires_at', v_expires,
    'slots_remaining', GREATEST(v_max - (v_used + 1), 0),
    'list_monthly_cents', v_list,
    'promo_monthly_cents', v_promo
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Ampliación (solo SA Total vía subscriptions.manage)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_extend_launch_seat_v1(
  p_pharmacy_id uuid,
  p_extra_days integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_row public.commercial_launch_seat_reservations%ROWTYPE;
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');
  v_days integer := coalesce(p_extra_days, 0);
  v_new_exp timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.subscriptions.manage') THEN
    RAISE EXCEPTION 'forbidden_subscriptions_manage' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'launch_extend_reason_required'
      USING MESSAGE = 'Motivo obligatorio para ampliar la reserva.';
  END IF;
  IF v_days < 1 OR v_days > 90 THEN
    RAISE EXCEPTION 'launch_extend_days_invalid';
  END IF;

  SELECT * INTO v_row
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'launch_seat_not_active';
  END IF;
  IF v_row.confirmed_at IS NOT NULL OR v_row.commitment_kind IS NOT NULL THEN
    RAISE EXCEPTION 'launch_seat_confirmed_immutable';
  END IF;

  v_new_exp := coalesce(v_row.expires_at, v_now) + make_interval(days => v_days);

  UPDATE public.commercial_launch_seat_reservations
  SET expires_at = v_new_exp,
      extended_at = v_now,
      extended_by = v_uid,
      extension_reason = v_reason,
      updated_at = v_now
  WHERE id = v_row.id;

  INSERT INTO public.commercial_launch_seat_events (
    cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
    commercial_sku_key, metadata
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_row.id, 'extended', v_uid, v_reason,
    v_row.commercial_sku_key,
    jsonb_build_object(
      'extra_days', v_days,
      'expires_at_before', v_row.expires_at,
      'expires_at_after', v_new_exp
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'reservation_id', v_row.id,
    'expires_at', v_new_exp,
    'extra_days', v_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_extend_launch_seat_v1(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_extend_launch_seat_v1(uuid, integer, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Caducidad idempotente (job). No envía emails. No toca confirmadas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_expire_launch_seats_v1(
  p_as_of timestamptz DEFAULT pg_catalog.now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := coalesce(p_as_of, pg_catalog.now());
  v_row record;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    OR current_setting('role', true) = 'service_role'
  ) THEN
    -- service_role vía JWT claim no siempre setea role; permitir service con manage
    IF NOT public.ff_has_platform_permission('platform.subscriptions.manage') THEN
      RAISE EXCEPTION 'forbidden_subscriptions_manage' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR v_row IN
    SELECT r.*
    FROM public.commercial_launch_seat_reservations r
    WHERE r.cohort_key = 'launch_2027'
      AND r.status = 'active'
      AND r.confirmed_at IS NULL
      AND r.commitment_kind IS NULL
      AND r.expires_at IS NOT NULL
      AND r.expires_at < v_now
    FOR UPDATE OF r
  LOOP
    UPDATE public.commercial_launch_seat_reservations
    SET status = 'expired',
        expired_at = v_now,
        updated_at = v_now
    WHERE id = v_row.id;

    UPDATE public.commercial_launch_cohort_counters
    SET used_slots = GREATEST(used_slots - 1, 0),
        updated_at = v_now
    WHERE cohort_key = 'launch_2027';

    INSERT INTO public.commercial_launch_seat_events (
      cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
      commercial_sku_key, metadata
    ) VALUES (
      'launch_2027', v_row.pharmacy_id, v_row.id, 'expired', v_uid,
      'auto_expiry',
      v_row.commercial_sku_key,
      jsonb_build_object('expires_at', v_row.expires_at, 'as_of', v_now)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'expired_count', v_count, 'as_of', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_expire_launch_seats_v1(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_expire_launch_seats_v1(timestamptz)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Avisos pendientes (preparación módulo Emails — sin envío)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_launch_seat_expiry_notices_due_v1(
  p_as_of date DEFAULT (pg_catalog.now() AT TIME ZONE 'Europe/Madrid')::date
)
RETURNS TABLE (
  reservation_id uuid,
  pharmacy_id uuid,
  expires_at timestamptz,
  notice_kind text,
  days_to_expiry integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    r.id,
    r.pharmacy_id,
    r.expires_at,
    CASE
      WHEN (r.expires_at AT TIME ZONE 'Europe/Madrid')::date = p_as_of THEN 'expiry_notice_0d'
      WHEN (r.expires_at AT TIME ZONE 'Europe/Madrid')::date = p_as_of + 2 THEN 'expiry_notice_2d'
      WHEN (r.expires_at AT TIME ZONE 'Europe/Madrid')::date = p_as_of + 5 THEN 'expiry_notice_5d'
      ELSE NULL
    END AS notice_kind,
    ((r.expires_at AT TIME ZONE 'Europe/Madrid')::date - p_as_of) AS days_to_expiry
  FROM public.commercial_launch_seat_reservations r
  WHERE r.cohort_key = 'launch_2027'
    AND r.status = 'active'
    AND r.confirmed_at IS NULL
    AND r.expires_at IS NOT NULL
    AND (r.expires_at AT TIME ZONE 'Europe/Madrid')::date IN (
      p_as_of, p_as_of + 2, p_as_of + 5
    );
$$;

REVOKE ALL ON FUNCTION public.ff_launch_seat_expiry_notices_due_v1(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_launch_seat_expiry_notices_due_v1(date)
  TO authenticated, service_role;

-- Confirmación: exige fixture de staging mientras no haya formalización 069
CREATE OR REPLACE FUNCTION public.ff_confirm_launch_seat_v1(
  p_pharmacy_id uuid,
  p_commitment_kind text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_row public.commercial_launch_seat_reservations%ROWTYPE;
  v_kind text := lower(btrim(coalesce(p_commitment_kind, '')));
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.subscriptions.manage') THEN
    RAISE EXCEPTION 'forbidden_subscriptions_manage' USING ERRCODE = '42501';
  END IF;

  -- Mientras emisión/firma jurídica estén bloqueadas: solo fixture staging explícito
  -- o commitment_kind = staging_fixture con nota que contenga [STAGING_FIXTURE].
  IF v_kind NOT IN (
    'contract_signed', 'invoice_issued', 'discount_locked', 'manual', 'staging_fixture'
  ) THEN
    RAISE EXCEPTION 'launch_commitment_invalid';
  END IF;

  IF v_kind IS DISTINCT FROM 'staging_fixture'
     AND position('[STAGING_FIXTURE]' in coalesce(v_notes, '')) = 0 THEN
    RAISE EXCEPTION 'launch_confirm_requires_formalization_or_fixture'
      USING MESSAGE =
        'Confirmación bloqueada: requiere formalización contractual válida o fixture [STAGING_FIXTURE] en staging.';
  END IF;

  IF v_kind = 'staging_fixture' AND position('[STAGING_FIXTURE]' in coalesce(v_notes, '')) = 0 THEN
    RAISE EXCEPTION 'launch_confirm_fixture_marker_required'
      USING MESSAGE = 'Fixture de staging: incluir [STAGING_FIXTURE] en las notas.';
  END IF;

  SELECT * INTO v_row
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'launch_seat_not_active';
  END IF;

  IF v_row.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'reservation_id', v_row.id,
      'commitment_kind', v_row.commitment_kind
    );
  END IF;

  UPDATE public.commercial_launch_seat_reservations
  SET confirmed_at = v_now,
      confirmed_by = v_uid,
      commitment_kind = CASE
        WHEN v_kind = 'staging_fixture' THEN 'manual'
        ELSE v_kind
      END,
      commitment_notes = v_notes,
      updated_at = v_now
  WHERE id = v_row.id;

  INSERT INTO public.commercial_launch_seat_events (
    cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
    commercial_sku_key, metadata
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_row.id, 'confirmed', v_uid, v_notes,
    v_row.commercial_sku_key,
    jsonb_build_object(
      'commitment_kind', v_kind,
      'staging_fixture', (v_kind = 'staging_fixture' OR position('[STAGING_FIXTURE]' in coalesce(v_notes, '')) > 0)
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'reservation_id', v_row.id,
    'commitment_kind', v_kind,
    'irreversible', true
  );
END;
$$;

COMMENT ON FUNCTION public.ff_confirm_launch_seat_v1(uuid, text, text) IS
  '092: confirma plaza (irreversible ordinaria). Sin formalización jurídica: solo fixture staging [STAGING_FIXTURE].';

-- DOWN: ver docs/commercial/MIGRACIONES_INVENTARIO_V1.md
