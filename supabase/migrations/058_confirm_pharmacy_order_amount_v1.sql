-- =============================================================================
-- 058_confirm_pharmacy_order_amount_v1.sql
-- Importe total confirmado por la farmacia (solicitudes QR / pending_confirmation).
--
-- - total_amount sentinel 0 + payment pending_confirmation ≠ precio confirmado.
-- - amount_confirmed_at NOT NULL = importe realmente confirmado (puede ser 0 €).
-- - Tras confirmar: payment_status → unpaid (SIN COBRAR). Nunca paid automático.
-- - Gate: no marcar paid en public_qr sin amount_confirmed_at.
--
-- Depende de: 040, 057.
-- NO APLICAR en producción sin autorización. Staging solo tras backup.
-- =============================================================================

ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS amount_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_confirmed_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pharmacy_orders.amount_confirmed_at IS
  'NULL = importe aún técnico/pendiente. NOT NULL = farmacia confirmó total_amount (trazabilidad).';
COMMENT ON COLUMN public.pharmacy_orders.amount_confirmed_by IS
  'Perfil que confirmó el importe total (orders.manage / platform).';

CREATE INDEX IF NOT EXISTS pharmacy_orders_amount_confirmed_idx
  ON public.pharmacy_orders (pharmacy_id, amount_confirmed_at DESC NULLS LAST)
  WHERE amount_confirmed_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RPC: confirmar importe total
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_confirm_pharmacy_order_amount_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order public.pharmacy_orders%ROWTYPE;
  v_amount numeric(12, 2);
  v_new_payment text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_pharmacy_id IS NULL OR p_order_id IS NULL OR p_amount IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  -- Euros con 2 decimales; rechazar más de 2 decimales significativos.
  IF round(p_amount, 2) IS DISTINCT FROM p_amount THEN
    RETURN jsonb_build_object('status', 'invalid_amount', 'reason', 'scale');
  END IF;

  v_amount := round(p_amount, 2);

  IF v_amount < 0 OR v_amount > 9999999.99 THEN
    RETURN jsonb_build_object('status', 'invalid_amount', 'reason', 'range');
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

  -- Tras confirmar: siempre sin cobrar (no paid automático).
  IF v_order.payment_status = 'pending_confirmation' THEN
    v_new_payment := 'unpaid';
  ELSIF v_order.payment_status IN ('unpaid', 'waived') THEN
    v_new_payment := v_order.payment_status;
  ELSIF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid');
  ELSIF v_order.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'refunded');
  ELSE
    RETURN jsonb_build_object(
      'status', 'invalid_payment_status',
      'payment_status', v_order.payment_status
    );
  END IF;

  IF
    v_order.total_amount IS NOT DISTINCT FROM v_amount
    AND v_order.amount_confirmed_at IS NOT NULL
    AND v_order.payment_status IS NOT DISTINCT FROM v_new_payment
  THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'unchanged', true,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'payment_status', v_order.payment_status,
      'total_amount', v_order.total_amount,
      'amount_confirmed_at', v_order.amount_confirmed_at,
      'amount_confirmed', true
    );
  END IF;

  UPDATE public.pharmacy_orders
  SET
    total_amount = v_amount,
    amount_confirmed_at = pg_catalog.now(),
    amount_confirmed_by = v_uid,
    payment_status = v_new_payment,
    payment_changed_at = CASE
      WHEN v_order.payment_status IS DISTINCT FROM v_new_payment
        THEN pg_catalog.now()
      ELSE payment_changed_at
    END,
    payment_changed_by = CASE
      WHEN v_order.payment_status IS DISTINCT FROM v_new_payment
        THEN v_uid
      ELSE payment_changed_by
    END,
    updated_at = pg_catalog.now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'status', 'ok',
    'unchanged', false,
    'order_id', v_order.id,
    'order_status', v_order.status,
    'payment_status', v_order.payment_status,
    'total_amount', v_order.total_amount,
    'currency', v_order.currency,
    'amount_confirmed_at', v_order.amount_confirmed_at,
    'amount_confirmed_by', v_order.amount_confirmed_by,
    'amount_confirmed', true
  );
END;
$$;

COMMENT ON FUNCTION public.ff_confirm_pharmacy_order_amount_v1(uuid, uuid, numeric) IS
  'Confirma importe total del pedido. Trazabilidad amount_confirmed_*. Tras confirmar: unpaid (nunca paid). Bloquea cancelled/delivered.';

REVOKE ALL ON FUNCTION public.ff_confirm_pharmacy_order_amount_v1(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_confirm_pharmacy_order_amount_v1(uuid, uuid, numeric)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Gate: public_qr no puede pasar a paid sin importe confirmado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_update_pharmacy_order_payment_status_v1(
  p_pharmacy_id uuid,
  p_order_id uuid,
  p_new_payment_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order public.pharmacy_orders%ROWTYPE;
  v_new text := lower(btrim(COALESCE(p_new_payment_status, '')));
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

  IF
    v_new = 'paid'
    AND v_order.source = 'public_qr'
    AND v_order.amount_confirmed_at IS NULL
  THEN
    RETURN jsonb_build_object('status', 'amount_not_confirmed');
  END IF;

  IF NOT public.ff_pharmacy_order_payment_transition_allowed(
    v_order.payment_status,
    v_new
  ) THEN
    RETURN jsonb_build_object(
      'status', 'invalid_transition',
      'from', v_order.payment_status,
      'to', v_new
    );
  END IF;

  IF v_order.payment_status = v_new THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'unchanged', true,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'payment_status', v_order.payment_status
    );
  END IF;

  UPDATE public.pharmacy_orders
  SET
    payment_status = v_new,
    payment_changed_at = pg_catalog.now(),
    payment_changed_by = v_uid,
    updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'unchanged', false,
    'order_id', v_order.id,
    'order_status', v_order.status,
    'payment_status', v_new
  );
END;
$$;

COMMENT ON FUNCTION public.ff_update_pharmacy_order_payment_status_v1(uuid, uuid, text) IS
  'Cambia payment_status. public_qr → paid exige amount_confirmed_at. Sin pasarela.';

-- DOWN (manual):
-- DROP FUNCTION IF EXISTS public.ff_confirm_pharmacy_order_amount_v1(uuid, uuid, numeric);
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS amount_confirmed_by;
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS amount_confirmed_at;
-- (restaurar cuerpo previo de ff_update_pharmacy_order_payment_status_v1 desde 057/040)
