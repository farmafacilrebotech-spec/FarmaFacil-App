-- =============================================================================
-- 080_supplier_po_annual_numbering_v1.sql
-- Numeración anual correlativa de pedidos de compra FarmaFácil:
--   2026/00000001, 2026/00000002, … / 2027/00000001
-- Se asigna SOLO al confirmar Borrador → Pedido (nunca en borrador).
-- Contador transaccional por año; no reutiliza números de cancelados.
-- No renumera pedidos existentes con order_number ya informado.
-- La extensión kiosk copia el número del pedido general (sin contador propio).
-- Staging primero. NO aplicar en producción sin autorización.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_supplier_po_year_counters (
  year integer PRIMARY KEY,
  last_seq bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_spo_year_counters_year_chk CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT platform_spo_year_counters_seq_chk CHECK (last_seq >= 0)
);

COMMENT ON TABLE public.platform_supplier_po_year_counters IS
  'Contador anual de números visibles de pedidos de compra (platform_supplier_purchase_orders).';

CREATE UNIQUE INDEX IF NOT EXISTS platform_spo_order_number_uidx
  ON public.platform_supplier_purchase_orders (order_number)
  WHERE order_number IS NOT NULL;

COMMENT ON COLUMN public.platform_supplier_purchase_orders.order_number IS
  'Número visible inmutable YYYY/00000001. NULL en borrador. Asignado al confirmar. UUID id sigue siendo la clave estable para facturas.';

-- -----------------------------------------------------------------------------
-- Asignación atómica del siguiente número del año
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_supplier_po_next_number_v1(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq bigint;
BEGIN
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'año de numeración inválido';
  END IF;

  INSERT INTO public.platform_supplier_po_year_counters AS c (year, last_seq, updated_at)
  VALUES (p_year, 1, pg_catalog.now())
  ON CONFLICT (year) DO UPDATE
    SET last_seq = c.last_seq + 1,
        updated_at = pg_catalog.now()
  RETURNING c.last_seq INTO v_seq;

  RETURN p_year::text || '/' || lpad(v_seq::text, 8, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.ff_supplier_po_next_number_v1(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_supplier_po_next_number_v1(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ff_supplier_po_next_number_v1(integer) TO service_role;

COMMENT ON FUNCTION public.ff_supplier_po_next_number_v1(integer) IS
  'Reserva el siguiente número YYYY/######## del año (row lock vía UPSERT). No reutiliza huecos.';

-- -----------------------------------------------------------------------------
-- Protección: order_number inmutable una vez asignado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_supplier_po_protect_order_number_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.order_number IS NOT NULL
     AND NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'El número de pedido % es inmutable', OLD.order_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_spo_protect_order_number
  ON public.platform_supplier_purchase_orders;
CREATE TRIGGER trg_platform_spo_protect_order_number
  BEFORE UPDATE ON public.platform_supplier_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_supplier_po_protect_order_number_v1();

-- -----------------------------------------------------------------------------
-- Confirmación Borrador → Pedido + número en la misma transacción
-- Idempotente: si ya tiene número, no asigna otro (anti doble clic).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_supplier_po_confirm_v1(
  p_id uuid,
  p_ordered_at date,
  p_expected_delivery_at date DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_supplier_purchase_orders%ROWTYPE;
  v_number text;
  v_year integer;
  v_already boolean := false;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'id obligatorio');
  END IF;
  IF p_ordered_at IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'Fecha de pedido obligatoria');
  END IF;

  SELECT * INTO v_row
  FROM public.platform_supplier_purchase_orders
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'Pedido no encontrado');
  END IF;

  IF v_row.status = 'cancelado' THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'Pedido cancelado');
  END IF;

  -- Ya confirmado / con número: idempotente, no asigna número nuevo.
  IF v_row.order_number IS NOT NULL THEN
    v_already := true;
    v_number := v_row.order_number;
    UPDATE public.platform_supplier_purchase_orders
    SET
      ordered_at = COALESCE(p_ordered_at, ordered_at),
      expected_delivery_at = COALESCE(p_expected_delivery_at, expected_delivery_at),
      updated_by = COALESCE(p_actor, updated_by),
      updated_at = pg_catalog.now()
    WHERE id = p_id;

    UPDATE public.kiosk_purchase_orders
    SET
      order_number = v_number,
      updated_at = pg_catalog.now()
    WHERE general_purchase_order_id = p_id
      AND status IS DISTINCT FROM 'cancelado'
      AND (order_number IS DISTINCT FROM v_number);

    RETURN jsonb_build_object(
      'status', 'ok',
      'id', p_id,
      'order_number', v_number,
      'already_confirmed', true
    );
  END IF;

  IF v_row.status IS DISTINCT FROM 'borrador' THEN
    -- Legacy sin número: permite asignar una sola vez al pasar a pedido.
    IF v_row.status NOT IN ('pedido', 'parcial', 'recibido', 'facturado') THEN
      RETURN jsonb_build_object(
        'status', 'error',
        'error', 'Solo se confirma desde borrador'
      );
    END IF;
  END IF;

  IF v_row.supplier_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'Proveedor obligatorio');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_supplier_purchase_lines l
    WHERE l.purchase_order_id = p_id
      AND length(btrim(l.description)) > 0
      AND l.quantity > 0
      AND l.unit_price_cents IS NOT NULL
      AND l.unit_price_cents >= 0
  ) THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Añade al menos una línea con descripción, cantidad y precio'
    );
  END IF;

  v_year := EXTRACT(YEAR FROM p_ordered_at)::integer;
  v_number := public.ff_supplier_po_next_number_v1(v_year);

  UPDATE public.platform_supplier_purchase_orders
  SET
    status = CASE
      WHEN status = 'borrador' THEN 'pedido'
      ELSE status
    END,
    order_number = v_number,
    ordered_at = p_ordered_at,
    expected_delivery_at = COALESCE(p_expected_delivery_at, expected_delivery_at),
    updated_by = COALESCE(p_actor, updated_by),
    updated_at = pg_catalog.now()
  WHERE id = p_id;

  -- Extensión kiosk: mismo número visible, sin contador propio.
  UPDATE public.kiosk_purchase_orders
  SET
    order_number = v_number,
    ordered_at = COALESCE(ordered_at, p_ordered_at),
    updated_at = pg_catalog.now()
  WHERE general_purchase_order_id = p_id
    AND status IS DISTINCT FROM 'cancelado';

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', p_id,
    'order_number', v_number,
    'already_confirmed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_supplier_po_confirm_v1(uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_supplier_po_confirm_v1(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ff_supplier_po_confirm_v1(uuid, date, date, uuid) TO service_role;

COMMENT ON FUNCTION public.ff_supplier_po_confirm_v1(uuid, date, date, uuid) IS
  'Confirma pedido de compra: asigna número anual correlativo en la misma transacción. Idempotente si ya tiene número.';
