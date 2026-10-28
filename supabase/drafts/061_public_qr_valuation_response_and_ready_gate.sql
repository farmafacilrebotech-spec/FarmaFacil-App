-- =============================================================================
-- 061_public_qr_valuation_response_and_ready_gate.sql
-- Parche INCREMENTAL sobre 060 ya aplicada en staging.
-- Solo CREATE OR REPLACE de 2 funciones. Sin ALTER TABLE, sin UPDATE de datos.
--
-- Cambios vs staging actual:
-- 1) ff_confirm_public_qr_line_valuation_v1: respuesta OK incluye updated_at.
-- 2) ff_update_pharmacy_order_status_v1: gate preparing→ready (además de
--    request_pending→preparing) vía ff_public_qr_may_enter_preparing_v1.
-- Pedidos históricos ya en ready NO se modifican.
-- Idempotente: re-ejecutar REPLACE es seguro.
-- =============================================================================


-- --- 1) Valoración: devolver updated_at ---
CREATE OR REPLACE FUNCTION public.ff_confirm_public_qr_line_valuation_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_lines jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL
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

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'order_cancelled');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('status', 'order_delivered');
  END IF;

  IF v_order.status NOT IN ('request_pending', 'preparing', 'ready') THEN
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

  -- Concurrencia: si el cliente envía updated_at esperado, debe coincidir.
  IF p_expected_updated_at IS NOT NULL
     AND v_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'status', 'concurrent_modification',
      'updated_at', v_order.updated_at
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

      -- MVP: disponible ⇒ precio estricto > 0 (0 € confirmado no autorizado).
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

  -- Todas las líneas del pedido deben haberse enviado.
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
    -- No tocar customer_accepted_*; valoración ≠ aceptación.
    updated_at = v_now
  WHERE id = v_order.id;

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
    'customer_accepted_at', v_order.customer_accepted_at,
    'awaiting_customer_acceptance', (v_order.customer_accepted_at IS NULL),
    'updated_at', v_now
  );
END;
$$;

COMMENT ON FUNCTION public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz) IS
  'Valora líneas public_qr; total servidor; unpaid sin cobro; no implica aceptación cliente.';

REVOKE ALL ON FUNCTION public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_confirm_public_qr_line_valuation_v1(uuid, uuid, jsonb, timestamptz)
  TO authenticated, service_role;

-- --- 2) Status: gate ready ---
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

  IF p_pharmacy_id IS NULL OR p_order_id IS NULL OR length(v_new) = 0 THEN
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

  SELECT *
  INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT public.ff_pharmacy_order_status_transition_allowed(v_order.status, v_new) THEN
    RETURN jsonb_build_object(
      'status', 'invalid_transition',
      'from', v_order.status,
      'to', v_new
    );
  END IF;

  IF v_order.status = v_new THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'unchanged', true,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'payment_status', v_order.payment_status
    );
  END IF;

  -- R3.1: bloquear preparing/ready en QR según valoración / aceptación.
  -- (Pedidos ya en ready históricos no se revierten; solo se bloquean transiciones nuevas.)
  IF v_order.source = 'public_qr'
     AND (
       (v_new = 'preparing' AND v_order.status = 'request_pending')
       OR (v_new = 'ready' AND v_order.status = 'preparing')
     )
  THEN
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
  'Cambia status operativo. Gate public_qr request_pending→preparing y preparing→ready: valoración + aceptación/legacy (061).';

REVOKE ALL ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text)
  TO authenticated, service_role;
