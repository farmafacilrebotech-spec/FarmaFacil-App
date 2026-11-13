-- =============================================================================
-- 089_launch_seat_events_commitment_v1.sql
-- Auditoría de plazas launch_2027 + compromiso (bloquea liberación simple).
-- Prerrequisito: 084 (commercial_launch_seat_reservations + RPCs).
-- NO APLICAR en producción sin autorización.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.commercial_launch_seat_reservations') IS NULL THEN
    RAISE EXCEPTION '089 requires 084 commercial_launch_seat_reservations';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Compromiso / confirmación (misma fila; no segundo sistema de plazas)
-- -----------------------------------------------------------------------------
ALTER TABLE public.commercial_launch_seat_reservations
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commitment_kind text NULL
    CHECK (
      commitment_kind IS NULL
      OR commitment_kind = ANY (
        ARRAY[
          'contract_signed'::text,
          'invoice_issued'::text,
          'discount_locked'::text,
          'manual'::text
        ]
      )
    ),
  ADD COLUMN IF NOT EXISTS commitment_notes text NULL;

COMMENT ON COLUMN public.commercial_launch_seat_reservations.confirmed_at IS
  '089: si no null, plaza confirmada/comprometida → no liberación simple.';

-- -----------------------------------------------------------------------------
-- Historial (append-only) — fuente de auditoría sin duplicar contador
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_launch_seat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key text NOT NULL DEFAULT 'launch_2027'
    REFERENCES public.commercial_launch_cohort_counters (cohort_key),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  reservation_id uuid NULL
    REFERENCES public.commercial_launch_seat_reservations (id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (
      event_type = ANY (
        ARRAY[
          'reserved'::text,
          're_reserved'::text,
          'released'::text,
          'confirmed'::text,
          'release_blocked'::text
        ]
      )
    ),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reason text NULL,
  commercial_sku_key text NULL,
  list_monthly_cents integer NULL,
  promo_monthly_cents integer NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS commercial_launch_seat_events_pharmacy_idx
  ON public.commercial_launch_seat_events (pharmacy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commercial_launch_seat_events_cohort_idx
  ON public.commercial_launch_seat_events (cohort_key, created_at DESC);

COMMENT ON TABLE public.commercial_launch_seat_events IS
  '089: historial append-only de reservas/liberaciones launch_2027. El contador sigue en commercial_launch_cohort_counters.';

ALTER TABLE public.commercial_launch_seat_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_launch_seat_events_select
  ON public.commercial_launch_seat_events;
CREATE POLICY commercial_launch_seat_events_select
  ON public.commercial_launch_seat_events
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
  );

DROP POLICY IF EXISTS commercial_launch_seat_events_insert
  ON public.commercial_launch_seat_events;
CREATE POLICY commercial_launch_seat_events_insert
  ON public.commercial_launch_seat_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );

GRANT SELECT, INSERT ON public.commercial_launch_seat_events TO authenticated;

-- -----------------------------------------------------------------------------
-- Liberación: exige motivo; bloquea si confirmada/comprometida; audita
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_release_launch_seat_v1(
  p_pharmacy_id uuid,
  p_reason text DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'launch_release_reason_required'
      USING MESSAGE = 'Indique un motivo de liberación (mín. 3 caracteres).';
  END IF;

  SELECT * INTO v_row
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'released', false, 'note', 'no_active_seat');
  END IF;

  IF v_row.confirmed_at IS NOT NULL OR v_row.commitment_kind IS NOT NULL THEN
    INSERT INTO public.commercial_launch_seat_events (
      cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
      commercial_sku_key, list_monthly_cents, promo_monthly_cents, metadata
    ) VALUES (
      'launch_2027', p_pharmacy_id, v_row.id, 'release_blocked', v_uid, v_reason,
      v_row.commercial_sku_key, v_row.list_monthly_cents, v_row.promo_monthly_cents,
      jsonb_build_object(
        'commitment_kind', v_row.commitment_kind,
        'confirmed_at', v_row.confirmed_at
      )
    );
    RAISE EXCEPTION 'launch_seat_committed'
      USING MESSAGE =
        'Plaza comprometida (contrato/factura/descuento). No se puede liberar de forma simple. Proceda por el flujo jurídico/comercial.';
  END IF;

  UPDATE public.commercial_launch_seat_reservations
  SET status = 'released',
      released_at = v_now,
      release_reason = v_reason,
      updated_at = v_now
  WHERE id = v_row.id;

  UPDATE public.commercial_launch_cohort_counters
  SET used_slots = GREATEST(used_slots - 1, 0),
      updated_at = v_now
  WHERE cohort_key = 'launch_2027';

  INSERT INTO public.commercial_launch_seat_events (
    cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
    commercial_sku_key, list_monthly_cents, promo_monthly_cents, metadata
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_row.id, 'released', v_uid, v_reason,
    v_row.commercial_sku_key, v_row.list_monthly_cents, v_row.promo_monthly_cents,
    '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'released', true,
    'reservation_id', v_row.id,
    'pharmacy_id', p_pharmacy_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Reserva: audita reserved / re_reserved (mantiene lógica 084)
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_list := public.ff_list_monthly_cents_v1(v_sku);
  v_promo := public.ff_launch_promo_cents_v1(v_sku);
  IF v_list IS NULL OR v_promo IS NULL THEN
    RAISE EXCEPTION 'launch_promo_invalid_sku'
      USING MESSAGE = 'SKU no elegible para promoción de lanzamiento.';
  END IF;

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
    UPDATE public.commercial_launch_seat_reservations
    SET commercial_sku_key = v_sku,
        list_monthly_cents = v_list,
        promo_monthly_cents = v_promo,
        updated_at = v_now
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'reservation_id', v_existing.id,
      'pharmacy_id', p_pharmacy_id,
      'slots_remaining', GREATEST(v_max - v_used, 0),
      'list_monthly_cents', v_list,
      'promo_monthly_cents', v_promo
    );
  END IF;

  IF v_used >= v_max THEN
    RAISE EXCEPTION 'launch_slots_exhausted'
      USING MESSAGE = 'No quedan plazas de lanzamiento 2027 (máx. 20).';
  END IF;

  IF FOUND AND v_existing.status = 'released' THEN
    UPDATE public.commercial_launch_seat_reservations
    SET status = 'active',
        commercial_sku_key = v_sku,
        list_monthly_cents = v_list,
        promo_monthly_cents = v_promo,
        reserved_at = v_now,
        reserved_by = v_uid,
        released_at = NULL,
        release_reason = NULL,
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
      reserved_at, reserved_by
    ) VALUES (
      'launch_2027', p_pharmacy_id, v_sku,
      v_list, v_promo, 'active',
      v_now, v_uid
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
    commercial_sku_key, list_monthly_cents, promo_monthly_cents
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_id, v_event, v_uid,
    v_sku, v_list, v_promo
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'reservation_id', v_id,
    'pharmacy_id', p_pharmacy_id,
    'slots_remaining', GREATEST(v_max - (v_used + 1), 0),
    'list_monthly_cents', v_list,
    'promo_monthly_cents', v_promo
  );
END;
$$;

-- Assign path still calls release with a reason when dropping promo; ensure default reason works via explicit callers.
-- Provide helper for SA to mark commitment without inventing a second counter.
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_kind NOT IN ('contract_signed', 'invoice_issued', 'discount_locked', 'manual') THEN
    RAISE EXCEPTION 'launch_commitment_invalid';
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

  UPDATE public.commercial_launch_seat_reservations
  SET confirmed_at = coalesce(confirmed_at, v_now),
      confirmed_by = coalesce(confirmed_by, v_uid),
      commitment_kind = v_kind,
      commitment_notes = NULLIF(btrim(coalesce(p_notes, '')), ''),
      updated_at = v_now
  WHERE id = v_row.id;

  INSERT INTO public.commercial_launch_seat_events (
    cohort_key, pharmacy_id, reservation_id, event_type, actor_id, reason,
    commercial_sku_key, metadata
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_row.id, 'confirmed', v_uid, p_notes,
    v_row.commercial_sku_key,
    jsonb_build_object('commitment_kind', v_kind)
  );

  RETURN jsonb_build_object('status', 'ok', 'reservation_id', v_row.id, 'commitment_kind', v_kind);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_confirm_launch_seat_v1(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_confirm_launch_seat_v1(uuid, text, text)
  TO authenticated, service_role;
