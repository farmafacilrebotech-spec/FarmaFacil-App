-- =============================================================================
-- 062_public_qr_quote_acceptance_v1.sql  (BORRADOR — NO APLICAR)
-- R4: enlace seguro /q/[token], aceptación/rechazo, historial, protecciones
-- de revaloración (decisiones A–H aprobadas).
--
-- Depende de: 040, 057, 058, 060, 061.
-- NO APLICAR en staging/producción sin autorización explícita.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Columnas de pedido
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS quote_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_rejected_at timestamptz;

COMMENT ON COLUMN public.pharmacy_orders.quote_version IS
  'Versión del presupuesto (R4). 0 = nunca valorado por líneas. +1 en cada valoración/revisión.';
COMMENT ON COLUMN public.pharmacy_orders.quote_expires_at IS
  'Caducidad de la versión vigente (72h al crear/cambiar versión). Regenerar token NO la amplía.';
COMMENT ON COLUMN public.pharmacy_orders.customer_rejected_at IS
  'Rechazo explícito del cliente del presupuesto (R4). NULL = no rechazado.';

COMMENT ON COLUMN public.pharmacy_orders.customer_accepted_at IS
  'Aceptación del cliente del presupuesto (R4). NULL = no aceptado. customer_accepted_by queda NULL (anónimo).';
COMMENT ON COLUMN public.pharmacy_orders.customer_accepted_by IS
  'Siempre NULL para aceptación anónima R4; la auditoría va en pharmacy_order_quote_events.';

-- -----------------------------------------------------------------------------
-- 2) Tokens (solo hash)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_order_quote_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.pharmacy_orders (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  quote_version integer NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  consumed_at timestamptz,
  decision text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_order_quote_tokens_hash_format_chk
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT pharmacy_order_quote_tokens_decision_chk
    CHECK (
      decision IS NULL
      OR decision = ANY (ARRAY['accepted', 'rejected'])
    ),
  CONSTRAINT pharmacy_order_quote_tokens_consumed_decision_chk
    CHECK (
      (consumed_at IS NULL AND decision IS NULL)
      OR (consumed_at IS NOT NULL AND decision IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_order_quote_tokens_hash_uid
  ON public.pharmacy_order_quote_tokens (token_hash);

CREATE INDEX IF NOT EXISTS pharmacy_order_quote_tokens_order_idx
  ON public.pharmacy_order_quote_tokens (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pharmacy_order_quote_tokens_pharmacy_idx
  ON public.pharmacy_order_quote_tokens (pharmacy_id, expires_at);

COMMENT ON TABLE public.pharmacy_order_quote_tokens IS
  'Tokens de presupuesto public_qr (R4). Solo SHA-256 hex; plaintext nunca en BD.';

ALTER TABLE public.pharmacy_order_quote_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pharmacy_order_quote_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_order_quote_tokens TO service_role;

-- Sin policies para authenticated/anon: acceso solo vía SECURITY DEFINER.

-- -----------------------------------------------------------------------------
-- 3) Historial de eventos (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_order_quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.pharmacy_orders (id) ON DELETE CASCADE,
  quote_version integer NOT NULL,
  event_type text NOT NULL,
  decision text,
  total_amount numeric(12, 2),
  token_id uuid REFERENCES public.pharmacy_order_quote_tokens (id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_order_quote_events_type_chk
    CHECK (
      event_type = ANY (
        ARRAY[
          'version_created',
          'token_issued',
          'token_revoked',
          'accepted',
          'rejected',
          'invalidated_by_revaluation',
          'revision_started'
        ]
      )
    ),
  CONSTRAINT pharmacy_order_quote_events_decision_chk
    CHECK (
      decision IS NULL
      OR decision = ANY (ARRAY['accepted', 'rejected'])
    )
);

CREATE INDEX IF NOT EXISTS pharmacy_order_quote_events_order_idx
  ON public.pharmacy_order_quote_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pharmacy_order_quote_events_pharmacy_idx
  ON public.pharmacy_order_quote_events (pharmacy_id, created_at DESC);

COMMENT ON TABLE public.pharmacy_order_quote_events IS
  'Historial append-only de versiones/decisiones de presupuesto public_qr (R4).';

ALTER TABLE public.pharmacy_order_quote_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pharmacy_order_quote_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.pharmacy_order_quote_events TO service_role;

-- Lectura staff vía RPC o policy opcional: SELECT authenticated con isolation
DROP POLICY IF EXISTS pharmacy_order_quote_events_select ON public.pharmacy_order_quote_events;
CREATE POLICY pharmacy_order_quote_events_select ON public.pharmacy_order_quote_events
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'orders.view')
    )
  );

GRANT SELECT ON TABLE public.pharmacy_order_quote_events TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) Helpers internos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_hash_quote_token_v1(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  -- pgcrypto vive en schema extensions (Supabase); search_path cerrado + qualify.
  SELECT encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');
$$;

REVOKE ALL ON FUNCTION public.ff_hash_quote_token_v1(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ff_log_pharmacy_order_quote_event_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_quote_version integer,
  p_event_type text,
  p_decision text DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL,
  p_token_id uuid DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.pharmacy_order_quote_events (
    pharmacy_id,
    order_id,
    quote_version,
    event_type,
    decision,
    total_amount,
    token_id,
    actor_profile_id,
    metadata
  )
  VALUES (
    p_pharmacy_id,
    p_order_id,
    p_quote_version,
    p_event_type,
    p_decision,
    p_total_amount,
    p_token_id,
    p_actor_profile_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_log_pharmacy_order_quote_event_v1(
  uuid, uuid, integer, text, text, numeric, uuid, uuid, jsonb
) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ff_revoke_active_quote_tokens_v1(
  p_order_id uuid,
  p_actor uuid DEFAULT NULL,
  p_reason text DEFAULT 'replaced'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.pharmacy_order_quote_tokens%ROWTYPE;
  v_count int := 0;
  v_now timestamptz := pg_catalog.now();
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.pharmacy_order_quote_tokens t
    WHERE t.order_id = p_order_id
      AND t.revoked_at IS NULL
      AND t.consumed_at IS NULL
    FOR UPDATE
  LOOP
    UPDATE public.pharmacy_order_quote_tokens
    SET revoked_at = v_now
    WHERE id = v_row.id;

    PERFORM public.ff_log_pharmacy_order_quote_event_v1(
      v_row.pharmacy_id,
      v_row.order_id,
      v_row.quote_version,
      'token_revoked',
      NULL,
      NULL,
      v_row.id,
      p_actor,
      jsonb_build_object('reason', p_reason)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_revoke_active_quote_tokens_v1(uuid, uuid, text)
  FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 5) Gate preparing: + rechazo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_public_qr_may_enter_preparing_v1(
  p_order public.pharmacy_orders
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_order.source IS DISTINCT FROM 'public_qr' THEN
    RETURN 'ok';
  END IF;

  IF p_order.customer_rejected_at IS NOT NULL THEN
    RETURN 'quote_rejected';
  END IF;

  IF p_order.lines_valued_at IS NOT NULL THEN
    IF p_order.customer_accepted_at IS NULL THEN
      RETURN 'quote_awaiting_customer_acceptance';
    END IF;
    RETURN 'ok';
  END IF;

  IF COALESCE(p_order.quote_legacy_total_only, false) IS TRUE THEN
    RETURN 'ok';
  END IF;

  RETURN 'valuation_required';
END;
$$;

COMMENT ON FUNCTION public.ff_public_qr_may_enter_preparing_v1(public.pharmacy_orders) IS
  'Gate preparing public_qr. ok | valuation_required | quote_awaiting_customer_acceptance | quote_rejected.';

-- -----------------------------------------------------------------------------
-- 6) Valoración: protecciones de revaloración (C) + versión/caducidad
--    Firma ampliada: p_allow_revision (revisión explícita tras aceptación).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz);

CREATE OR REPLACE FUNCTION public.ff_confirm_public_qr_line_valuation_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_lines jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_allow_revision boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order public.pharmacy_orders%ROWTYPE;
  v_elem jsonb;
  v_item_id uuid;
  v_availability text;
  v_unit numeric(12, 2);
  v_note text;
  v_item public.pharmacy_order_items%ROWTYPE;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_line_count int;
  v_total numeric(12, 2) := 0;
  v_available_count int := 0;
  v_new_payment text;
  v_now timestamptz := pg_catalog.now();
  v_new_version int;
  v_new_expires timestamptz;
  v_was_accepted boolean;
  v_bump_version boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_pharmacy_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RETURN jsonb_build_object('status', 'invalid_lines', 'reason', 'not_array');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(p_pharmacy_id)
      AND public.ff_pharmacy_is_operable(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'orders.manage')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT *
  INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_order.source IS DISTINCT FROM 'public_qr' THEN
    RETURN jsonb_build_object('status', 'not_public_qr');
  END IF;

  IF COALESCE(v_order.quote_legacy_total_only, false) IS TRUE THEN
    RETURN jsonb_build_object('status', 'legacy_total_only');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'order_cancelled');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('status', 'order_delivered');
  END IF;

  -- C: una vez en preparación/listo → bloquear revaloración normal.
  IF v_order.status IN ('preparing', 'ready') THEN
    RETURN jsonb_build_object(
      'status', 'valuation_locked',
      'order_status', v_order.status,
      'message', 'El pedido ya está en preparación o listo. Usa cancelación/revisión específica.'
    );
  END IF;

  IF v_order.status IS DISTINCT FROM 'request_pending' THEN
    RETURN jsonb_build_object(
      'status', 'invalid_order_status',
      'order_status', v_order.status
    );
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid');
  END IF;

  IF v_order.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'refunded');
  END IF;

  IF p_expected_updated_at IS NOT NULL
     AND v_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'status', 'concurrent_modification',
      'updated_at', v_order.updated_at
    );
  END IF;

  v_was_accepted := (v_order.customer_accepted_at IS NOT NULL);

  -- C: tras aceptación, solo con p_allow_revision explícito.
  IF v_was_accepted AND COALESCE(p_allow_revision, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'status', 'revision_required',
      'message', 'El presupuesto ya fue aceptado. Inicia una revisión explícita para volver a valorar.'
    );
  END IF;

  IF v_was_accepted AND COALESCE(p_allow_revision, false) IS TRUE THEN
    PERFORM public.ff_log_pharmacy_order_quote_event_v1(
      v_order.pharmacy_id,
      v_order.id,
      COALESCE(v_order.quote_version, 0),
      'revision_started',
      NULL,
      v_order.total_amount,
      NULL,
      v_uid,
      '{}'::jsonb
    );
  END IF;

  SELECT count(*)::int INTO v_line_count
  FROM public.pharmacy_order_items
  WHERE order_id = v_order.id;

  IF v_line_count = 0 THEN
    RETURN jsonb_build_object('status', 'empty_order');
  END IF;

  IF jsonb_array_length(p_lines) <> v_line_count THEN
    RETURN jsonb_build_object(
      'status', 'invalid_lines',
      'reason', 'count_mismatch',
      'expected', v_line_count,
      'got', jsonb_array_length(p_lines)
    );
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_item_id := (v_elem->>'item_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('status', 'invalid_lines', 'reason', 'bad_item_id');
    END;

    IF v_item_id IS NULL THEN
      RETURN jsonb_build_object('status', 'invalid_lines', 'reason', 'missing_item_id');
    END IF;

    IF v_item_id = ANY (v_seen) THEN
      RETURN jsonb_build_object('status', 'invalid_lines', 'reason', 'duplicate_item');
    END IF;
    v_seen := array_append(v_seen, v_item_id);

    v_availability := lower(btrim(COALESCE(v_elem->>'availability', '')));
    IF v_availability NOT IN ('available', 'unavailable') THEN
      RETURN jsonb_build_object(
        'status', 'invalid_lines',
        'reason', 'availability',
        'item_id', v_item_id
      );
    END IF;

    SELECT * INTO v_item
    FROM public.pharmacy_order_items
    WHERE id = v_item_id
      AND order_id = v_order.id
      AND pharmacy_id = p_pharmacy_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'invalid_lines',
        'reason', 'item_not_found',
        'item_id', v_item_id
      );
    END IF;

    IF v_item.quantity < 1 OR v_item.quantity > 99 THEN
      RETURN jsonb_build_object(
        'status', 'invalid_quantity',
        'item_id', v_item_id
      );
    END IF;

    v_note := NULLIF(btrim(COALESCE(v_elem->>'staff_note', '')), '');
    IF v_note IS NOT NULL THEN
      IF length(v_note) > 280 OR v_note ~ '[[:cntrl:]]' THEN
        RETURN jsonb_build_object(
          'status', 'invalid_note',
          'item_id', v_item_id
        );
      END IF;
    END IF;

    IF v_availability = 'unavailable' THEN
      v_unit := 0;
    ELSE
      BEGIN
        v_unit := (v_elem->>'unit_price')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'status', 'invalid_amount',
          'reason', 'parse',
          'item_id', v_item_id
        );
      END;

      IF v_unit IS NULL THEN
        RETURN jsonb_build_object(
          'status', 'invalid_amount',
          'reason', 'null',
          'item_id', v_item_id
        );
      END IF;

      IF round(v_unit, 2) IS DISTINCT FROM v_unit THEN
        RETURN jsonb_build_object(
          'status', 'invalid_amount',
          'reason', 'scale',
          'item_id', v_item_id
        );
      END IF;

      v_unit := round(v_unit, 2);

      IF v_unit <= 0 OR v_unit > 9999999.99 THEN
        RETURN jsonb_build_object(
          'status', 'invalid_amount',
          'reason', 'range',
          'item_id', v_item_id
        );
      END IF;

      v_available_count := v_available_count + 1;
      v_total := v_total + round(v_unit * v_item.quantity, 2);
    END IF;

    UPDATE public.pharmacy_order_items
    SET
      availability_status = v_availability,
      unit_price = v_unit,
      line_total = round(v_unit * quantity, 2),
      staff_note = v_note,
      priced_at = v_now,
      priced_by = v_uid
    WHERE id = v_item_id;
  END LOOP;

  IF (
    SELECT count(*)::int
    FROM public.pharmacy_order_items
    WHERE order_id = v_order.id
      AND NOT (id = ANY (v_seen))
  ) > 0 THEN
    RETURN jsonb_build_object('status', 'invalid_lines', 'reason', 'incomplete');
  END IF;

  IF v_order.payment_status = 'pending_confirmation' THEN
    v_new_payment := 'unpaid';
  ELSIF v_order.payment_status IN ('unpaid', 'waived') THEN
    v_new_payment := v_order.payment_status;
  ELSE
    RETURN jsonb_build_object(
      'status', 'invalid_payment_status',
      'payment_status', v_order.payment_status
    );
  END IF;

  -- Versión: primera valoración → 1; revaloración/revisión → +1 y nueva caducidad.
  IF v_order.lines_valued_at IS NULL THEN
    v_new_version := 1;
    v_bump_version := true;
  ELSE
    v_new_version := COALESCE(v_order.quote_version, 0) + 1;
    v_bump_version := true;
  END IF;

  IF v_bump_version THEN
    v_new_expires := v_now + interval '72 hours';
    PERFORM public.ff_revoke_active_quote_tokens_v1(
      v_order.id,
      v_uid,
      CASE WHEN v_was_accepted THEN 'revision' ELSE 'revaluation' END
    );
    IF v_order.lines_valued_at IS NOT NULL OR v_was_accepted THEN
      PERFORM public.ff_log_pharmacy_order_quote_event_v1(
        v_order.pharmacy_id,
        v_order.id,
        COALESCE(v_order.quote_version, 0),
        'invalidated_by_revaluation',
        NULL,
        v_order.total_amount,
        NULL,
        v_uid,
        jsonb_build_object(
          'from_version', COALESCE(v_order.quote_version, 0),
          'to_version', v_new_version
        )
      );
    END IF;
  ELSE
    v_new_expires := v_order.quote_expires_at;
  END IF;

  UPDATE public.pharmacy_orders
  SET
    total_amount = v_total,
    payment_status = v_new_payment,
    payment_changed_at = CASE
      WHEN payment_status IS DISTINCT FROM v_new_payment THEN v_now
      ELSE payment_changed_at
    END,
    payment_changed_by = CASE
      WHEN payment_status IS DISTINCT FROM v_new_payment THEN v_uid
      ELSE payment_changed_by
    END,
    amount_confirmed_at = v_now,
    amount_confirmed_by = v_uid,
    lines_valued_at = v_now,
    lines_valued_by = v_uid,
    quote_version = v_new_version,
    quote_expires_at = v_new_expires,
    customer_accepted_at = NULL,
    customer_accepted_by = NULL,
    customer_rejected_at = NULL,
    updated_at = v_now
  WHERE id = v_order.id;

  PERFORM public.ff_log_pharmacy_order_quote_event_v1(
    v_order.pharmacy_id,
    v_order.id,
    v_new_version,
    'version_created',
    NULL,
    v_total,
    NULL,
    v_uid,
    jsonb_build_object('available_lines', v_available_count)
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'unchanged', false,
    'order_id', v_order.id,
    'order_status', v_order.status,
    'payment_status', v_new_payment,
    'total_amount', v_total,
    'available_lines', v_available_count,
    'amount_confirmed', true,
    'amount_confirmed_at', v_now,
    'lines_valued_at', v_now,
    'customer_accepted_at', NULL,
    'customer_rejected_at', NULL,
    'awaiting_customer_acceptance', true,
    'quote_version', v_new_version,
    'quote_expires_at', v_new_expires,
    'updated_at', v_now
  );
END;
$$;

COMMENT ON FUNCTION public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz, boolean) IS
  'Valora líneas public_qr (R4). Bump versión+caducidad; limpia aceptación; bloquea preparing+; revisión explícita tras accept.';

REVOKE ALL ON FUNCTION public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz, boolean)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7) Emitir token (staff) — NO amplía caducidad de la versión
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_issue_public_qr_quote_token_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_token_plaintext text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order public.pharmacy_orders%ROWTYPE;
  v_hash text;
  v_token_id uuid;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_pharmacy_id IS NULL OR p_order_id IS NULL
     OR p_token_plaintext IS NULL
     OR length(p_token_plaintext) < 43 THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  -- Token base64url ~32 bytes ≈ 43+ chars; rechazo si parece demasiado corto.
  IF length(p_token_plaintext) > 128 OR p_token_plaintext ~ '\s' THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(p_pharmacy_id)
      AND public.ff_pharmacy_is_operable(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'orders.manage')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_order.source IS DISTINCT FROM 'public_qr' THEN
    RETURN jsonb_build_object('status', 'not_public_qr');
  END IF;

  IF COALESCE(v_order.quote_legacy_total_only, false) IS TRUE THEN
    RETURN jsonb_build_object('status', 'legacy_total_only');
  END IF;

  IF v_order.lines_valued_at IS NULL OR COALESCE(v_order.quote_version, 0) < 1 THEN
    RETURN jsonb_build_object('status', 'valuation_required');
  END IF;

  IF v_order.status IN ('cancelled', 'delivered') THEN
    RETURN jsonb_build_object('status', 'order_closed');
  END IF;

  IF v_order.customer_accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_accepted');
  END IF;

  IF v_order.customer_rejected_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_rejected');
  END IF;

  IF v_order.quote_expires_at IS NULL OR v_order.quote_expires_at <= v_now THEN
    RETURN jsonb_build_object('status', 'quote_expired');
  END IF;

  v_hash := public.ff_hash_quote_token_v1(p_token_plaintext);

  -- E: un solo activo por pedido+versión → revocar anteriores.
  PERFORM public.ff_revoke_active_quote_tokens_v1(v_order.id, v_uid, 'replaced');

  INSERT INTO public.pharmacy_order_quote_tokens (
    pharmacy_id,
    order_id,
    token_hash,
    quote_version,
    expires_at,
    created_by
  )
  VALUES (
    v_order.pharmacy_id,
    v_order.id,
    v_hash,
    v_order.quote_version,
    v_order.quote_expires_at, -- A: NO ampliar
    v_uid
  )
  RETURNING id INTO v_token_id;

  PERFORM public.ff_log_pharmacy_order_quote_event_v1(
    v_order.pharmacy_id,
    v_order.id,
    v_order.quote_version,
    'token_issued',
    NULL,
    v_order.total_amount,
    v_token_id,
    v_uid,
    '{}'::jsonb
  );

  -- El plaintext solo viaja en la respuesta de esta RPC (la app lo recibe una vez).
  RETURN jsonb_build_object(
    'status', 'ok',
    'token', p_token_plaintext,
    'token_id', v_token_id,
    'order_id', v_order.id,
    'display_number', v_order.display_number,
    'quote_version', v_order.quote_version,
    'expires_at', v_order.quote_expires_at,
    'total_amount', v_order.total_amount
  );
END;
$$;

COMMENT ON FUNCTION public.ff_issue_public_qr_quote_token_v1(uuid, uuid, text) IS
  'Emite token de presupuesto. Caducidad = quote_expires_at del pedido (no se amplía).';

REVOKE ALL ON FUNCTION public.ff_issue_public_qr_quote_token_v1(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_issue_public_qr_quote_token_v1(uuid, uuid, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) Lectura pública por token
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_get_public_qr_quote_by_token_v1(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hash text;
  v_tok public.pharmacy_order_quote_tokens%ROWTYPE;
  v_order public.pharmacy_orders%ROWTYPE;
  v_pharmacy_name text;
  v_now timestamptz := pg_catalog.now();
  v_lines jsonb;
  v_state text;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 20 THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_hash := public.ff_hash_quote_token_v1(btrim(p_token));

  SELECT * INTO v_tok
  FROM public.pharmacy_order_quote_tokens
  WHERE token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = v_tok.order_id
    AND pharmacy_id = v_tok.pharmacy_id;

  IF NOT FOUND OR v_order.source IS DISTINCT FROM 'public_qr' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  SELECT name INTO v_pharmacy_name
  FROM public.pharmacies
  WHERE id = v_order.pharmacy_id;

  IF v_tok.quote_version IS DISTINCT FROM v_order.quote_version THEN
    v_state := 'stale_version';
  ELSIF v_tok.consumed_at IS NOT NULL AND v_tok.decision = 'accepted' THEN
    v_state := 'accepted';
  ELSIF v_tok.consumed_at IS NOT NULL AND v_tok.decision = 'rejected' THEN
    v_state := 'rejected';
  ELSIF v_order.customer_accepted_at IS NOT NULL THEN
    v_state := 'accepted';
  ELSIF v_order.customer_rejected_at IS NOT NULL THEN
    v_state := 'rejected';
  ELSIF v_tok.expires_at <= v_now OR COALESCE(v_order.quote_expires_at, v_tok.expires_at) <= v_now THEN
    v_state := 'expired';
  ELSIF v_order.status = 'cancelled' THEN
    v_state := 'cancelled';
  ELSE
    v_state := 'awaiting_decision';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_name', i.product_name,
        'quantity', i.quantity,
        'availability', i.availability_status,
        'unit_price', i.unit_price,
        'line_total', i.line_total
      )
      ORDER BY i.created_at, i.id
    ),
    '[]'::jsonb
  )
  INTO v_lines
  FROM public.pharmacy_order_items i
  WHERE i.order_id = v_order.id
    AND i.pharmacy_id = v_order.pharmacy_id;

  -- Sin nombre/teléfono del cliente en respuesta pública.
  RETURN jsonb_build_object(
    'status', 'ok',
    'quote_state', v_state,
    'pharmacy_name', COALESCE(v_pharmacy_name, 'Farmacia'),
    'display_number', v_order.display_number,
    'quote_version', v_order.quote_version,
    'token_quote_version', v_tok.quote_version,
    'currency', v_order.currency,
    'total_amount', v_order.total_amount,
    'expires_at', COALESCE(v_order.quote_expires_at, v_tok.expires_at),
    'decided_at', v_tok.consumed_at,
    'decision', v_tok.decision,
    'can_decide', (v_state = 'awaiting_decision'),
    'lines', v_lines
  );
END;
$$;

COMMENT ON FUNCTION public.ff_get_public_qr_quote_by_token_v1(text) IS
  'Lectura pública de presupuesto por token. Sin PII de cliente. Errores genéricos.';

REVOKE ALL ON FUNCTION public.ff_get_public_qr_quote_by_token_v1(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_get_public_qr_quote_by_token_v1(text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9) Decisión pública (atómica, idempotente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_decide_public_qr_quote_by_token_v1(
  p_token text,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hash text;
  v_tok public.pharmacy_order_quote_tokens%ROWTYPE;
  v_order public.pharmacy_orders%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
  v_decision text;
BEGIN
  v_decision := lower(btrim(COALESCE(p_decision, '')));
  IF v_decision NOT IN ('accepted', 'rejected') THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) < 20 THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_hash := public.ff_hash_quote_token_v1(btrim(p_token));

  SELECT * INTO v_tok
  FROM public.pharmacy_order_quote_tokens
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND OR v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  -- D: ya decidido → idempotente si misma decisión; rechazo si contradictoria.
  IF v_tok.consumed_at IS NOT NULL THEN
    IF v_tok.decision = v_decision THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'unchanged', true,
        'decision', v_tok.decision,
        'decided_at', v_tok.consumed_at
      );
    END IF;
    RETURN jsonb_build_object(
      'status', 'already_decided',
      'decision', v_tok.decision
    );
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = v_tok.order_id
    AND pharmacy_id = v_tok.pharmacy_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.source IS DISTINCT FROM 'public_qr' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'order_cancelled');
  END IF;

  IF v_tok.quote_version IS DISTINCT FROM v_order.quote_version THEN
    RETURN jsonb_build_object('status', 'stale_version');
  END IF;

  IF v_order.lines_valued_at IS NULL THEN
    RETURN jsonb_build_object('status', 'valuation_required');
  END IF;

  IF v_order.customer_accepted_at IS NOT NULL OR v_order.customer_rejected_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_decided');
  END IF;

  IF v_tok.expires_at <= v_now
     OR COALESCE(v_order.quote_expires_at, v_tok.expires_at) <= v_now THEN
    RETURN jsonb_build_object('status', 'quote_expired');
  END IF;

  UPDATE public.pharmacy_order_quote_tokens
  SET
    consumed_at = v_now,
    decision = v_decision
  WHERE id = v_tok.id;

  IF v_decision = 'accepted' THEN
    UPDATE public.pharmacy_orders
    SET
      customer_accepted_at = v_now,
      customer_accepted_by = NULL,
      customer_rejected_at = NULL,
      updated_at = v_now
    WHERE id = v_order.id;

    PERFORM public.ff_log_pharmacy_order_quote_event_v1(
      v_order.pharmacy_id,
      v_order.id,
      v_order.quote_version,
      'accepted',
      'accepted',
      v_order.total_amount,
      v_tok.id,
      NULL,
      '{}'::jsonb
    );
  ELSE
    UPDATE public.pharmacy_orders
    SET
      customer_rejected_at = v_now,
      customer_accepted_at = NULL,
      customer_accepted_by = NULL,
      updated_at = v_now
    WHERE id = v_order.id;

    PERFORM public.ff_log_pharmacy_order_quote_event_v1(
      v_order.pharmacy_id,
      v_order.id,
      v_order.quote_version,
      'rejected',
      'rejected',
      v_order.total_amount,
      v_tok.id,
      NULL,
      '{}'::jsonb
    );
  END IF;

  -- B: no cambia payment_status a paid; no cambia status operativo.
  RETURN jsonb_build_object(
    'status', 'ok',
    'unchanged', false,
    'decision', v_decision,
    'decided_at', v_now,
    'display_number', v_order.display_number,
    'total_amount', v_order.total_amount,
    'quote_version', v_order.quote_version
  );
END;
$$;

COMMENT ON FUNCTION public.ff_decide_public_qr_quote_by_token_v1(text, text) IS
  'Acepta/rechaza presupuesto por token. Atómico e idempotente. Sin cobro ni auto-preparing.';

REVOKE ALL ON FUNCTION public.ff_decide_public_qr_quote_by_token_v1(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_decide_public_qr_quote_by_token_v1(text, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10) Status RPC: mapear quote_rejected
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_update_pharmacy_order_status_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order public.pharmacy_orders%ROWTYPE;
  v_new text := lower(btrim(COALESCE(p_new_status, '')));
  v_gate text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(p_pharmacy_id)
      AND public.ff_pharmacy_is_operable(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'orders.manage')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_new = v_order.status THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'unchanged', true,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'payment_status', v_order.payment_status
    );
  END IF;

  -- Transiciones permitidas (espejo 057/040).
  IF NOT (
    (v_order.status = 'request_pending' AND v_new IN ('preparing', 'cancelled'))
    OR (v_order.status = 'preparing' AND v_new IN ('ready', 'cancelled'))
    OR (v_order.status = 'ready' AND v_new IN ('delivered', 'cancelled'))
    OR (v_order.status = 'pending_payment' AND v_new IN ('preparing', 'cancelled'))
  ) THEN
    RETURN jsonb_build_object(
      'status', 'invalid_transition',
      'from', v_order.status,
      'to', v_new
    );
  END IF;

  IF v_order.source = 'public_qr'
     AND (
       (v_new = 'preparing' AND v_order.status = 'request_pending')
       OR (v_new = 'ready' AND v_order.status = 'preparing')
     ) THEN
    v_gate := public.ff_public_qr_may_enter_preparing_v1(v_order);
    IF v_gate = 'valuation_required' THEN
      RETURN jsonb_build_object(
        'status', 'valuation_required',
        'message', 'Confirma disponibilidad y precios por producto antes de continuar.'
      );
    END IF;
    IF v_gate = 'quote_awaiting_customer_acceptance' THEN
      RETURN jsonb_build_object(
        'status', 'quote_awaiting_customer_acceptance',
        'message', 'Presupuesto pendiente de aceptación del cliente.'
      );
    END IF;
    IF v_gate = 'quote_rejected' THEN
      RETURN jsonb_build_object(
        'status', 'quote_rejected',
        'message', 'El cliente rechazó el presupuesto. No se puede preparar este pedido.'
      );
    END IF;
  END IF;

  UPDATE public.pharmacy_orders
  SET
    status = v_new,
    status_changed_at = pg_catalog.now(),
    status_changed_by = v_uid,
    updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'unchanged', false,
    'order_id', v_order.id,
    'order_status', v_new,
    'payment_status', v_order.payment_status
  );
END;
$$;

COMMENT ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text) IS
  'Cambia status operativo. Gate public_qr preparing/ready: valoración + aceptación; bloquea rechazados (062).';

REVOKE ALL ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text)
  TO authenticated, service_role;
