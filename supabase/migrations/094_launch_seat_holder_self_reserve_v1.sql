-- =============================================================================
-- 094_launch_seat_holder_self_reserve_v1.sql
-- Reserva directa por titular (PHARMACY_OWNER activo).
--
-- - Verifica identidad (auth.uid) + rol OWNER
-- - Elegibilidad promo + SKU + disponibilidad transaccional
-- - Anti-duplicado (idempotente si ya active)
-- - expires_at obligatorio; historial holder_reserved
-- - Notificación interna SA (audit_log + activity)
-- - Titular NO puede liberar / ampliar / confirmar (RPCs SA)
--
-- Prerrequisito: 092.
-- SOLO staging.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.commercial_launch_seat_settings') IS NULL THEN
    RAISE EXCEPTION '094 requires 092 commercial_launch_seat_settings';
  END IF;
END $$;

-- Lectura RLS: titular ve su propia reserva
DROP POLICY IF EXISTS commercial_launch_seat_reservations_holder_select
  ON public.commercial_launch_seat_reservations;
CREATE POLICY commercial_launch_seat_reservations_holder_select
  ON public.commercial_launch_seat_reservations
  FOR SELECT TO authenticated
  USING (
    public.ff_actor_pharmacy_role_key(pharmacy_id) = 'PHARMACY_OWNER'
  );

DROP POLICY IF EXISTS commercial_launch_seat_events_holder_select
  ON public.commercial_launch_seat_events;
CREATE POLICY commercial_launch_seat_events_holder_select
  ON public.commercial_launch_seat_events
  FOR SELECT TO authenticated
  USING (
    public.ff_actor_pharmacy_role_key(pharmacy_id) = 'PHARMACY_OWNER'
  );

CREATE OR REPLACE FUNCTION public.ff_holder_reserve_launch_2027_seat_v1(
  p_pharmacy_id uuid,
  p_commercial_sku_key text,
  p_ack_conditions boolean DEFAULT false
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
  v_role text;
  v_list integer;
  v_promo integer;
  v_max integer;
  v_used integer;
  v_existing public.commercial_launch_seat_reservations%ROWTYPE;
  v_id uuid;
  v_ttl integer := public.ff_launch_seat_default_ttl_days_v1('launch_2027');
  v_expires timestamptz;
  v_event text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_pharmacy_id IS NULL THEN
    RAISE EXCEPTION 'pharmacy_id_required' USING ERRCODE = '23514';
  END IF;
  IF coalesce(p_ack_conditions, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'launch_holder_ack_required'
      USING MESSAGE = 'Debe aceptar las condiciones y la fecha de caducidad de la reserva.';
  END IF;

  v_role := public.ff_actor_pharmacy_role_key(p_pharmacy_id);
  IF v_role IS DISTINCT FROM 'PHARMACY_OWNER' THEN
    RAISE EXCEPTION 'forbidden_holder_reserve'
      USING ERRCODE = '42501',
            MESSAGE = 'Solo el titular (PHARMACY_OWNER) puede reservar la plaza promocional.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = p_pharmacy_id) THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_list := public.ff_list_monthly_cents_v1(v_sku);
  v_promo := public.ff_launch_promo_cents_v1(v_sku);
  IF v_list IS NULL OR v_promo IS NULL THEN
    RAISE EXCEPTION 'launch_promo_invalid_sku'
      USING MESSAGE = 'Plan promocional no elegible (General / Personalizado / Asistente IA).';
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
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'reservation_id', v_existing.id,
      'pharmacy_id', p_pharmacy_id,
      'expires_at', v_existing.expires_at,
      'commercial_sku_key', v_existing.commercial_sku_key,
      'slots_remaining', GREATEST(v_max - v_used, 0),
      'note', 'Ya existe una reserva activa; no se crea duplicado.'
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
        reserved_by_kind = 'holder',
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
      v_now, v_uid, 'holder', v_expires
    )
    RETURNING id INTO v_id;
    v_event := 'holder_reserved';
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
    'launch_2027', p_pharmacy_id, v_id,
    CASE WHEN v_event = 're_reserved' THEN 're_reserved' ELSE 'holder_reserved' END,
    v_uid, v_sku, v_list, v_promo,
    jsonb_build_object(
      'actor_kind', 'holder',
      'expires_at', v_expires,
      'ttl_days', v_ttl,
      'ack_conditions', true
    )
  );

  -- Notificación interna SuperAdmin (sin email)
  PERFORM public.ff_write_audit_log(
    'commercial.launch_seat.holder_reserved',
    p_pharmacy_id,
    'commercial_launch_seat_reservation',
    v_id::text,
    jsonb_build_object(
      'sku', v_sku,
      'expires_at', v_expires,
      'actor_id', v_uid,
      'notify', 'superadmin_internal'
    ),
    NULL,
    NULL
  );

  PERFORM public.ff_record_activity_event(
    p_pharmacy_id,
    'commercial.launch_seat.holder_reserved',
    'Reserva promocional por titular',
    format('Titular reservó plaza launch_2027 (%s) hasta %s', v_sku, v_expires::text),
    jsonb_build_object(
      'reservation_id', v_id,
      'sku', v_sku,
      'expires_at', v_expires
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'reservation_id', v_id,
    'pharmacy_id', p_pharmacy_id,
    'expires_at', v_expires,
    'ttl_days', v_ttl,
    'commercial_sku_key', v_sku,
    'list_monthly_cents', v_list,
    'promo_monthly_cents', v_promo,
    'slots_remaining', GREATEST(v_max - (v_used + 1), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.ff_holder_reserve_launch_2027_seat_v1(uuid, text, boolean) IS
  '094: reserva plaza launch_2027 por PHARMACY_OWNER. Sin liberar/ampliar/confirmar.';

REVOKE ALL ON FUNCTION public.ff_holder_reserve_launch_2027_seat_v1(uuid, text, boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_holder_reserve_launch_2027_seat_v1(uuid, text, boolean)
  TO authenticated;

-- Solicitud de contratación (titular): solo evento + audit; no confirma plaza
CREATE OR REPLACE FUNCTION public.ff_holder_request_contract_v1(
  p_pharmacy_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row public.commercial_launch_seat_reservations%ROWTYPE;
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  v_role := public.ff_actor_pharmacy_role_key(p_pharmacy_id);
  IF v_role IS DISTINCT FROM 'PHARMACY_OWNER' THEN
    RAISE EXCEPTION 'forbidden_holder_contract_request' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'launch_seat_not_active'
      USING MESSAGE = 'No hay reserva activa para solicitar contratación.';
  END IF;

  INSERT INTO public.commercial_launch_seat_events (
    cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
    commercial_sku_key, metadata
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_row.id, 'contract_request', v_uid, v_notes,
    v_row.commercial_sku_key,
    jsonb_build_object('pipeline', 'solicitud_contratacion')
  );

  PERFORM public.ff_write_audit_log(
    'commercial.contract.request',
    p_pharmacy_id,
    'commercial_launch_seat_reservation',
    v_row.id::text,
    jsonb_build_object('notes', v_notes, 'notify', 'superadmin_internal'),
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'reservation_id', v_row.id,
    'pipeline', 'solicitud_contratacion'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_holder_request_contract_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_holder_request_contract_v1(uuid, text) TO authenticated;
