-- =============================================================================
-- 040_pharmacy_orders_v1.sql
-- Dominio de pedidos (pharmacy_orders / items) reutilizable por kiosko y canales.
--
-- Seguridad:
--   - Aislamiento por pharmacy_id (RLS + RPCs DEFINER).
--   - Kiosko crea vía RPC con credential_hash de sesión de dispositivo (anon).
--   - Precios y total se calculan SOLO en servidor desde pharmacy_products.
--   - Idempotencia: UNIQUE (pharmacy_id, client_request_id).
--   - Staff panel: orders.view (todos roles); orders.manage (OWNER/ADMIN/PHARMACIST; no STAFF).
--
-- NO implementa cobros ni pasarelas. payment_status ≠ status operativo.
-- NO APLICAR automáticamente en producción.
-- Depende de: 004, 005, 011, 020, 028, 032, 034, 036.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Módulo + permisos
-- -----------------------------------------------------------------------------
INSERT INTO public.modules (key, name, description, is_core, is_active)
VALUES (
  'orders',
  'Pedidos',
  'Pedidos de mostrador, kiosko y canales de venta. Núcleo operativo.',
  true,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_core = EXCLUDED.is_core,
  is_active = EXCLUDED.is_active;

INSERT INTO public.permissions (key, module_key, description)
VALUES
  (
    'orders.view',
    'orders',
    'Ver pedidos de la farmacia'
  ),
  (
    'orders.manage',
    'orders',
    'Actualizar estado operativo y de pago de pedidos'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

-- Política de roles (seed): STAFF = operativo limitado → solo .view;
-- PHARMACIST+ = operativo amplio / admin → view + manage de cola.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN (
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF'
)
  AND p.key = 'orders.view'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN (
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST'
)
  AND p.key = 'orders.manage'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_modules (plan_id, module_id, default_limits)
SELECT pl.id, m.id, '{}'::jsonb
FROM public.plans pl
CROSS JOIN public.modules m
WHERE m.key = 'orders'
  AND pl.key IN ('starter', 'pro', 'business', 'enterprise')
ON CONFLICT (plan_id, module_id) DO NOTHING;

INSERT INTO public.pharmacy_entitlements (
  pharmacy_id,
  module_id,
  status,
  source,
  source_plan_id,
  limits,
  config
)
SELECT
  s.pharmacy_id,
  m.id,
  'active',
  'plan',
  s.plan_id,
  '{}'::jsonb,
  '{}'::jsonb
FROM public.subscriptions s
INNER JOIN public.modules m ON m.key = 'orders'
WHERE s.status IN ('trialing', 'active', 'past_due')
ON CONFLICT (pharmacy_id, module_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2) Contador de número de pedido por farmacia
-- -----------------------------------------------------------------------------
CREATE TABLE public.pharmacy_order_counters (
  pharmacy_id uuid PRIMARY KEY
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  last_number bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_order_counters_last_number_nonneg_chk CHECK (last_number >= 0)
);

COMMENT ON TABLE public.pharmacy_order_counters IS
  'Secuencia de números de pedido por farmacia (lock row en creación).';

ALTER TABLE public.pharmacy_order_counters ENABLE ROW LEVEL SECURITY;
-- Sin policies para authenticated/anon: solo DEFINER / service_role.

-- -----------------------------------------------------------------------------
-- 3) pharmacy_orders
-- -----------------------------------------------------------------------------
CREATE TABLE public.pharmacy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  order_number bigint NOT NULL,
  display_number text NOT NULL,
  source text NOT NULL DEFAULT 'kiosk',
  device_id uuid
    REFERENCES public.pharmacy_devices (id) ON DELETE SET NULL,
  device_session_id uuid
    REFERENCES public.pharmacy_device_sessions (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  payment_status text NOT NULL DEFAULT 'unpaid',
  total_amount numeric(12, 2) NOT NULL
    CONSTRAINT pharmacy_orders_total_nonneg_chk CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'EUR'
    CONSTRAINT pharmacy_orders_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  client_request_id text NOT NULL,
  created_by_profile_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  status_changed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  status_changed_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  payment_changed_at timestamptz,
  payment_changed_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_orders_source_chk CHECK (
    source = ANY (ARRAY['kiosk', 'counter', 'online', 'other'])
  ),
  CONSTRAINT pharmacy_orders_status_chk CHECK (
    status = ANY (ARRAY[
      'pending_payment',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    ])
  ),
  CONSTRAINT pharmacy_orders_payment_status_chk CHECK (
    payment_status = ANY (ARRAY[
      'unpaid',
      'paid',
      'refunded',
      'waived'
    ])
  ),
  CONSTRAINT pharmacy_orders_order_number_positive_chk CHECK (order_number > 0),
  CONSTRAINT pharmacy_orders_display_number_not_blank_chk CHECK (
    length(btrim(display_number)) > 0
  ),
  CONSTRAINT pharmacy_orders_client_request_id_not_blank_chk CHECK (
    length(btrim(client_request_id)) > 0
    AND length(btrim(client_request_id)) <= 128
  ),
  CONSTRAINT pharmacy_orders_pharmacy_order_number_uid UNIQUE (pharmacy_id, order_number),
  CONSTRAINT pharmacy_orders_pharmacy_client_request_uid UNIQUE (pharmacy_id, client_request_id)
);

COMMENT ON TABLE public.pharmacy_orders IS
  'Pedidos por farmacia. status = flujo operativo; payment_status = cobro (separados).';
COMMENT ON COLUMN public.pharmacy_orders.client_request_id IS
  'Idempotencia por farmacia (reintentos de red del kiosko / canal).';
COMMENT ON COLUMN public.pharmacy_orders.total_amount IS
  'Total calculado en servidor; nunca confiar en el cliente.';

CREATE INDEX pharmacy_orders_pharmacy_created_idx
  ON public.pharmacy_orders (pharmacy_id, created_at DESC);

CREATE INDEX pharmacy_orders_pharmacy_status_idx
  ON public.pharmacy_orders (pharmacy_id, status, created_at DESC);

CREATE INDEX pharmacy_orders_device_id_idx
  ON public.pharmacy_orders (device_id)
  WHERE device_id IS NOT NULL;

CREATE TRIGGER pharmacy_orders_set_updated_at
  BEFORE UPDATE ON public.pharmacy_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) pharmacy_order_items
-- -----------------------------------------------------------------------------
CREATE TABLE public.pharmacy_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.pharmacy_orders (id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  product_id uuid
    REFERENCES public.pharmacy_products (id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL
    CONSTRAINT pharmacy_order_items_quantity_positive_chk CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL
    CONSTRAINT pharmacy_order_items_unit_price_nonneg_chk CHECK (unit_price >= 0),
  line_total numeric(12, 2) NOT NULL
    CONSTRAINT pharmacy_order_items_line_total_nonneg_chk CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_order_items_name_not_blank_chk CHECK (
    length(btrim(product_name)) > 0
  ),
  CONSTRAINT pharmacy_order_items_line_total_matches_chk CHECK (
    line_total = round(unit_price * quantity, 2)
  )
);

COMMENT ON TABLE public.pharmacy_order_items IS
  'Líneas de pedido. product_name y unit_price congelados en el momento de la compra.';

CREATE INDEX pharmacy_order_items_order_id_idx
  ON public.pharmacy_order_items (order_id);

CREATE INDEX pharmacy_order_items_pharmacy_id_idx
  ON public.pharmacy_order_items (pharmacy_id);

CREATE INDEX pharmacy_order_items_product_id_idx
  ON public.pharmacy_order_items (product_id)
  WHERE product_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_order_items ENABLE ROW LEVEL SECURITY;

-- Staff / plataforma: lectura operativa con permiso.
CREATE POLICY pharmacy_orders_select ON public.pharmacy_orders
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'orders.view')
    )
  );

CREATE POLICY pharmacy_order_items_select ON public.pharmacy_order_items
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'orders.view')
    )
  );

-- Sin INSERT/UPDATE/DELETE directos para authenticated: solo RPCs DEFINER.
GRANT SELECT ON TABLE public.pharmacy_orders TO authenticated;
GRANT SELECT ON TABLE public.pharmacy_order_items TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) Transiciones (espejo TypeScript lib/orders/transitions.ts)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_order_status_transition_allowed(
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_from IS NULL OR p_to IS NULL THEN false
    WHEN p_from = p_to THEN true
    WHEN p_from = 'pending_payment' AND p_to IN ('preparing', 'cancelled') THEN true
    WHEN p_from = 'preparing' AND p_to IN ('ready', 'cancelled') THEN true
    WHEN p_from = 'ready' AND p_to IN ('delivered', 'cancelled') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_order_status_transition_allowed(text, text) IS
  'Transiciones operativas válidas de pharmacy_orders.status.';

CREATE OR REPLACE FUNCTION public.ff_pharmacy_order_payment_transition_allowed(
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_from IS NULL OR p_to IS NULL THEN false
    WHEN p_from = p_to THEN true
    WHEN p_from = 'unpaid' AND p_to IN ('paid', 'waived') THEN true
    WHEN p_from = 'paid' AND p_to = 'refunded' THEN true
    WHEN p_from = 'waived' AND p_to = 'paid' THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_order_payment_transition_allowed(text, text) IS
  'Transiciones válidas de pharmacy_orders.payment_status (sin pasarela).';

REVOKE ALL ON FUNCTION public.ff_pharmacy_order_status_transition_allowed(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_pharmacy_order_payment_transition_allowed(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_order_status_transition_allowed(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_order_payment_transition_allowed(text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7) RPC: crear pedido desde kiosko (sesión dispositivo)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_create_order_v1(
  p_credential_hash text,
  p_items jsonb,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
  v_request_id text;
  v_existing public.pharmacy_orders%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_product public.pharmacy_products%ROWTYPE;
  v_line_total numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_next bigint;
  v_order_id uuid;
  v_display text;
  v_lines jsonb := '[]'::jsonb;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  v_request_id := nullif(btrim(COALESCE(p_client_request_id, '')), '');
  IF v_request_id IS NULL OR length(v_request_id) > 128 THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('status', 'empty_cart');
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RETURN jsonb_build_object('status', 'invalid_cart');
  END IF;

  SELECT *
  INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = btrim(p_credential_hash)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  SELECT *
  INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id
  FOR UPDATE;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  IF v_device.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_session.pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;

  -- Idempotencia: misma farmacia + client_request_id → pedido existente.
  SELECT *
  INTO v_existing
  FROM public.pharmacy_orders
  WHERE pharmacy_id = v_session.pharmacy_id
    AND client_request_id = v_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'order_id', v_existing.id,
      'pharmacy_id', v_existing.pharmacy_id,
      'order_number', v_existing.order_number,
      'display_number', v_existing.display_number,
      'order_status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency,
      'created_at', v_existing.created_at
    );
  END IF;

  -- Validar líneas y calcular total (precios SOLO desde BD).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RETURN jsonb_build_object('status', 'invalid_cart');
    END IF;

    BEGIN
      v_product_id := NULLIF(btrim(COALESCE(v_item->>'product_id', '')), '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('status', 'invalid_product');
    END;

    IF v_product_id IS NULL THEN
      RETURN jsonb_build_object('status', 'invalid_product');
    END IF;

    -- Evitar duplicar el mismo product_id en el carrito (fusionar no; rechazar).
    IF v_product_id = ANY (v_seen) THEN
      RETURN jsonb_build_object('status', 'duplicate_product_in_cart');
    END IF;
    v_seen := array_append(v_seen, v_product_id);

    BEGIN
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object('status', 'invalid_quantity');
    END;

    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN
      RETURN jsonb_build_object('status', 'invalid_quantity');
    END IF;

    -- Si el cliente envía unit_price, se IGNORA (anti-manipulación).
    SELECT *
    INTO v_product
    FROM public.pharmacy_products
    WHERE id = v_product_id
    FOR SHARE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'product_not_found',
        'product_id', v_product_id
      );
    END IF;

    -- Farmacia distinta a la de la sesión → rechazo (no filtrar por existencia ajena).
    IF v_product.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id THEN
      RETURN jsonb_build_object(
        'status', 'product_wrong_pharmacy',
        'product_id', v_product_id
      );
    END IF;

    IF v_product.is_active IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'status', 'product_inactive',
        'product_id', v_product_id
      );
    END IF;

    v_line_total := round(v_product.price * v_qty, 2);
    v_total := v_total + v_line_total;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'quantity', v_qty,
        'unit_price', v_product.price,
        'line_total', v_line_total
      )
    );
  END LOOP;

  IF v_total <= 0 THEN
    RETURN jsonb_build_object('status', 'invalid_total');
  END IF;

  -- Número de pedido por farmacia.
  INSERT INTO public.pharmacy_order_counters (pharmacy_id, last_number, updated_at)
  VALUES (v_session.pharmacy_id, 0, pg_catalog.now())
  ON CONFLICT (pharmacy_id) DO NOTHING;

  UPDATE public.pharmacy_order_counters
  SET
    last_number = last_number + 1,
    updated_at = pg_catalog.now()
  WHERE pharmacy_id = v_session.pharmacy_id
  RETURNING last_number INTO v_next;

  v_display := lpad(v_next::text, 4, '0');

  INSERT INTO public.pharmacy_orders (
    pharmacy_id,
    order_number,
    display_number,
    source,
    device_id,
    device_session_id,
    status,
    payment_status,
    total_amount,
    currency,
    client_request_id
  )
  VALUES (
    v_session.pharmacy_id,
    v_next,
    v_display,
    'kiosk',
    v_device.id,
    v_session.id,
    'pending_payment',
    'unpaid',
    v_total,
    'EUR',
    v_request_id
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.pharmacy_order_items (
    order_id,
    pharmacy_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    line_total
  )
  SELECT
    v_order_id,
    v_session.pharmacy_id,
    (elem->>'product_id')::uuid,
    elem->>'product_name',
    (elem->>'quantity')::integer,
    (elem->>'unit_price')::numeric,
    (elem->>'line_total')::numeric
  FROM jsonb_array_elements(v_lines) AS elem;

  UPDATE public.pharmacy_device_sessions
  SET last_seen_at = pg_catalog.now()
  WHERE id = v_session.id;

  UPDATE public.pharmacy_devices
  SET last_seen_at = pg_catalog.now()
  WHERE id = v_device.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'order_id', v_order_id,
    'pharmacy_id', v_session.pharmacy_id,
    'order_number', v_next,
    'display_number', v_display,
    'order_status', 'pending_payment',
    'payment_status', 'unpaid',
    'total_amount', v_total,
    'currency', 'EUR',
    'items', v_lines
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_create_order_v1(text, jsonb, text) IS
  'Crea pedido kiosko con sesión de dispositivo. Precios servidor; idempotente por client_request_id.';

REVOKE ALL ON FUNCTION public.ff_kiosk_create_order_v1(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_create_order_v1(text, jsonb, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) RPC: kiosko consulta SU pedido (misma farmacia + dispositivo)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_get_order_v1(
  p_credential_hash text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
  v_order public.pharmacy_orders%ROWTYPE;
  v_items jsonb;
BEGIN
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  SELECT *
  INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = btrim(p_credential_hash);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  SELECT *
  INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  IF v_device.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_session.pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;

  SELECT *
  INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Solo pedidos de la misma farmacia y dispositivo de la sesión.
  IF v_order.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id
     OR v_order.device_id IS DISTINCT FROM v_device.id THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'product_id', i.product_id,
        'product_name', i.product_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total
      )
      ORDER BY i.created_at, i.id
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.pharmacy_order_items i
  WHERE i.order_id = v_order.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'order', jsonb_build_object(
      'id', v_order.id,
      'pharmacy_id', v_order.pharmacy_id,
      'order_number', v_order.order_number,
      'display_number', v_order.display_number,
      'source', v_order.source,
      'order_status', v_order.status,
      'payment_status', v_order.payment_status,
      'total_amount', v_order.total_amount,
      'currency', v_order.currency,
      'created_at', v_order.created_at,
      'items', v_items
    )
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_get_order_v1(text, uuid) IS
  'Detalle de pedido para el kiosko que lo creó (misma sesión de dispositivo/farmacia).';

REVOKE ALL ON FUNCTION public.ff_kiosk_get_order_v1(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_get_order_v1(text, uuid)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9) RPC: actualizar estado operativo (staff)
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
  'Cambia status operativo del pedido. Requiere orders.manage o platform write.';

REVOKE ALL ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_update_pharmacy_order_status_v1(uuid, uuid, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10) RPC: actualizar estado de pago (staff; sin pasarela)
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
  'Cambia payment_status (presencial). Independiente del status operativo.';

REVOKE ALL ON FUNCTION public.ff_update_pharmacy_order_payment_status_v1(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_update_pharmacy_order_payment_status_v1(uuid, uuid, text)
  TO authenticated, service_role;

-- =============================================================================
-- DOWN (manual):
-- DROP FUNCTION IF EXISTS public.ff_update_pharmacy_order_payment_status_v1(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_update_pharmacy_order_status_v1(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_get_order_v1(text, uuid);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_create_order_v1(text, jsonb, text);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_order_payment_transition_allowed(text, text);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_order_status_transition_allowed(text, text);
-- DROP TABLE IF EXISTS public.pharmacy_order_items;
-- DROP TABLE IF EXISTS public.pharmacy_orders;
-- DROP TABLE IF EXISTS public.pharmacy_order_counters;
-- DELETE FROM public.role_permissions WHERE permission_id IN
--   (SELECT id FROM public.permissions WHERE key LIKE 'orders.%');
-- DELETE FROM public.permissions WHERE key LIKE 'orders.%';
-- DELETE FROM public.plan_modules WHERE module_id IN
--   (SELECT id FROM public.modules WHERE key = 'orders');
-- DELETE FROM public.pharmacy_entitlements WHERE module_id IN
--   (SELECT id FROM public.modules WHERE key = 'orders');
-- DELETE FROM public.modules WHERE key = 'orders';
-- =============================================================================
