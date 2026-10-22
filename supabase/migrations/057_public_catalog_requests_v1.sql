-- =============================================================================
-- 057_public_catalog_requests_v1.sql
-- Solicitudes desde catálogo público QR → pharmacy_orders / pharmacy_order_items.
--
-- Depende de: 040 (pedidos), 028 (operable), 011 (ff_pharmacy_has_module),
--             050/055 (Piloto/General: entrypoint_qr + orders, SIN kiosk),
--             054–055 (modalidad catálogo + listado público).
--
-- Autorizado aplicar en staging 2026-10-21 (Fase 7). No aplica a producción aquí.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Extender source + status + payment_status (compat. pedidos existentes)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_orders
  DROP CONSTRAINT IF EXISTS pharmacy_orders_source_chk;

ALTER TABLE public.pharmacy_orders
  ADD CONSTRAINT pharmacy_orders_source_chk CHECK (
    source = ANY (ARRAY['kiosk', 'counter', 'online', 'other', 'public_qr']::text[])
  );

ALTER TABLE public.pharmacy_orders
  DROP CONSTRAINT IF EXISTS pharmacy_orders_status_chk;

ALTER TABLE public.pharmacy_orders
  ADD CONSTRAINT pharmacy_orders_status_chk CHECK (
    status = ANY (ARRAY[
      'pending_payment',
      'request_pending',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    ]::text[])
  );

ALTER TABLE public.pharmacy_orders
  DROP CONSTRAINT IF EXISTS pharmacy_orders_payment_status_chk;

ALTER TABLE public.pharmacy_orders
  ADD CONSTRAINT pharmacy_orders_payment_status_chk CHECK (
    payment_status = ANY (ARRAY[
      'unpaid',
      'pending_confirmation',
      'paid',
      'refunded',
      'waived'
    ]::text[])
  );

COMMENT ON COLUMN public.pharmacy_orders.status IS
  'Flujo operativo. request_pending = solicitud QR pendiente de confirmación por la farmacia.';
COMMENT ON COLUMN public.pharmacy_orders.payment_status IS
  'Cobro. pending_confirmation = importe aún no confirmado (NO es waived ni venta gratuita).';

-- -----------------------------------------------------------------------------
-- 2) Columnas de contacto (solo canal público)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_note text;

COMMENT ON COLUMN public.pharmacy_orders.customer_name IS
  'Nombre de contacto (solicitudes public_qr). Solo visible a staff autorizado.';
COMMENT ON COLUMN public.pharmacy_orders.customer_phone IS
  'Teléfono normalizado (9 dígitos ES). No exponer en APIs públicas ni logs.';
COMMENT ON COLUMN public.pharmacy_orders.privacy_accepted_at IS
  'Momento de aceptación de información de privacidad en el formulario público.';
COMMENT ON COLUMN public.pharmacy_orders.customer_note IS
  'Nota opcional del cliente (acotada en RPC).';

ALTER TABLE public.pharmacy_orders
  DROP CONSTRAINT IF EXISTS pharmacy_orders_public_qr_contact_chk;

ALTER TABLE public.pharmacy_orders
  ADD CONSTRAINT pharmacy_orders_public_qr_contact_chk CHECK (
    source <> 'public_qr'
    OR (
      customer_name IS NOT NULL
      AND length(btrim(customer_name)) BETWEEN 2 AND 80
      AND customer_phone IS NOT NULL
      AND length(btrim(customer_phone)) BETWEEN 9 AND 20
      AND privacy_accepted_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS pharmacy_orders_public_phone_created_idx
  ON public.pharmacy_orders (pharmacy_id, customer_phone, created_at DESC)
  WHERE source = 'public_qr' AND customer_phone IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) Transiciones: añadir request_pending / pending_confirmation (compat 040)
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
    WHEN p_from = 'request_pending' AND p_to IN ('preparing', 'cancelled') THEN true
    WHEN p_from = 'preparing' AND p_to IN ('ready', 'cancelled') THEN true
    WHEN p_from = 'ready' AND p_to IN ('delivered', 'cancelled') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_order_status_transition_allowed(text, text) IS
  'Transiciones operativas. Incluye request_pending (solicitudes QR). Compat. kiosko 040.';

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
    WHEN p_from = 'pending_confirmation' AND p_to IN ('unpaid', 'paid', 'waived') THEN true
    WHEN p_from = 'unpaid' AND p_to IN ('paid', 'waived') THEN true
    WHEN p_from = 'paid' AND p_to = 'refunded' THEN true
    WHEN p_from = 'waived' AND p_to = 'paid' THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_order_payment_transition_allowed(text, text) IS
  'Transiciones de cobro. pending_confirmation = importe por confirmar (≠ waived).';

-- -----------------------------------------------------------------------------
-- 4) Gate público (independiente de kiosk)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_public_catalog_request_allowed(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND public.ff_pharmacy_is_operable(p_pharmacy_id)
    AND public.ff_pharmacy_has_module(p_pharmacy_id, 'entrypoint_qr')
    AND public.ff_pharmacy_has_module(p_pharmacy_id, 'orders');
$$;

COMMENT ON FUNCTION public.ff_public_catalog_request_allowed(uuid) IS
  'Solicitudes QR: operable + entrypoint_qr + orders. NO exige módulo kiosk.';

REVOKE ALL ON FUNCTION public.ff_public_catalog_request_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_public_catalog_request_allowed(uuid)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) RPC pública: crear solicitud desde /e/{publicId}/catalogo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_public_catalog_create_request_v1(
  p_public_id text,
  p_items jsonb,
  p_client_request_id text,
  p_customer_name text,
  p_customer_phone text,
  p_privacy_accepted boolean,
  p_customer_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id text;
  v_ep public.public_entrypoints%ROWTYPE;
  v_pharmacy_name text;
  v_mode text;
  v_request_id text;
  v_name text;
  v_phone_raw text;
  v_phone text;
  v_note text;
  v_existing public.pharmacy_orders%ROWTYPE;
  v_recent_count integer;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_product public.pharmacy_products%ROWTYPE;
  v_unit numeric(12, 2);
  v_line_total numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_next bigint;
  v_order_id uuid;
  v_display text;
  v_lines jsonb := '[]'::jsonb;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_pricing_pending boolean := true;
BEGIN
  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id IS NULL OR v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_request_id := nullif(btrim(COALESCE(p_client_request_id, '')), '');
  IF v_request_id IS NULL OR length(v_request_id) > 128 THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  IF p_privacy_accepted IS NOT TRUE THEN
    RETURN jsonb_build_object('status', 'privacy_required');
  END IF;

  v_name := nullif(btrim(COALESCE(p_customer_name, '')), '');
  IF v_name IS NULL OR length(v_name) < 2 OR length(v_name) > 80 THEN
    RETURN jsonb_build_object('status', 'invalid_customer_name');
  END IF;
  IF v_name ~ '[[:cntrl:]]' THEN
    RETURN jsonb_build_object('status', 'invalid_customer_name');
  END IF;

  v_phone_raw := nullif(btrim(COALESCE(p_customer_phone, '')), '');
  IF v_phone_raw IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_customer_phone');
  END IF;
  v_phone := regexp_replace(v_phone_raw, '[^0-9+]', '', 'g');
  IF v_phone ~ '^\+34' THEN
    v_phone := substring(v_phone from 4);
  ELSIF v_phone ~ '^0034' THEN
    v_phone := substring(v_phone from 5);
  ELSIF v_phone ~ '^34[6-9]' AND length(v_phone) = 11 THEN
    v_phone := substring(v_phone from 3);
  END IF;
  IF v_phone !~ '^[6-9][0-9]{8}$' THEN
    RETURN jsonb_build_object('status', 'invalid_customer_phone');
  END IF;

  v_note := nullif(btrim(COALESCE(p_customer_note, '')), '');
  IF v_note IS NOT NULL THEN
    IF length(v_note) > 280 OR v_note ~ '[[:cntrl:]]' THEN
      RETURN jsonb_build_object('status', 'invalid_note');
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('status', 'empty_cart');
  END IF;

  IF jsonb_array_length(p_items) > 20 THEN
    RETURN jsonb_build_object('status', 'invalid_cart');
  END IF;

  SELECT * INTO v_ep
  FROM public.public_entrypoints pe
  WHERE pe.public_id = v_id
    AND pe.purpose = 'pharmacy_home'
  LIMIT 1
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_ep.is_active IS NOT TRUE
     OR (v_ep.expires_at IS NOT NULL AND v_ep.expires_at <= pg_catalog.now()) THEN
    RETURN jsonb_build_object('status', 'inactive');
  END IF;

  SELECT p.name INTO v_pharmacy_name
  FROM public.pharmacies p
  WHERE p.id = v_ep.pharmacy_id;

  IF v_pharmacy_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Gate independiente de kiosk.
  IF NOT public.ff_pharmacy_is_operable(v_ep.pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'pharmacy_unavailable');
  END IF;

  IF NOT public.ff_pharmacy_has_module(v_ep.pharmacy_id, 'entrypoint_qr') THEN
    RETURN jsonb_build_object('status', 'public_catalog_disabled');
  END IF;

  IF NOT public.ff_pharmacy_has_module(v_ep.pharmacy_id, 'orders') THEN
    RETURN jsonb_build_object('status', 'orders_not_entitled');
  END IF;

  -- Defensa en profundidad (misma semántica que ff_public_catalog_request_allowed).
  IF NOT public.ff_public_catalog_request_allowed(v_ep.pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;

  v_mode := public.ff_pharmacy_catalog_mode(v_ep.pharmacy_id);

  -- Idempotencia.
  SELECT *
  INTO v_existing
  FROM public.pharmacy_orders
  WHERE pharmacy_id = v_ep.pharmacy_id
    AND client_request_id = v_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'display_number', v_existing.display_number,
      'order_number', v_existing.order_number,
      'order_status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'pricing_pending', (v_existing.payment_status = 'pending_confirmation'),
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency,
      'pharmacy_name', v_pharmacy_name,
      'catalog_mode', v_mode,
      'created_at', v_existing.created_at
    );
  END IF;

  SELECT count(*)::integer INTO v_recent_count
  FROM public.pharmacy_orders o
  WHERE o.pharmacy_id = v_ep.pharmacy_id
    AND o.source = 'public_qr'
    AND o.customer_phone = v_phone
    AND o.created_at > (pg_catalog.now() - interval '1 hour');

  IF v_recent_count >= 5 THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;

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

    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 20 THEN
      RETURN jsonb_build_object('status', 'invalid_quantity');
    END IF;

    SELECT *
    INTO v_product
    FROM public.pharmacy_products
    WHERE id = v_product_id
    FOR SHARE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'product_not_found', 'product_id', v_product_id);
    END IF;

    IF v_product.pharmacy_id IS DISTINCT FROM v_ep.pharmacy_id THEN
      RETURN jsonb_build_object('status', 'product_wrong_pharmacy', 'product_id', v_product_id);
    END IF;

    IF v_product.is_active IS NOT TRUE THEN
      RETURN jsonb_build_object('status', 'product_inactive', 'product_id', v_product_id);
    END IF;

    IF NOT public.ff_pharmacy_product_visible_in_active_catalog(v_product.source, v_mode) THEN
      RETURN jsonb_build_object('status', 'product_not_visible', 'product_id', v_product_id);
    END IF;

    IF lower(COALESCE(v_product.availability_status, 'available')) = 'unavailable' THEN
      RETURN jsonb_build_object('status', 'product_unavailable', 'product_id', v_product_id);
    END IF;

    -- Genérico / precio nulo → sentinel 0 (NO es precio final ni venta gratuita).
    -- Propio con precio → estimación de catálogo; payment sigue pending_confirmation.
    IF v_mode = 'generic' OR v_product.price IS NULL THEN
      v_unit := 0;
    ELSE
      v_unit := round(GREATEST(v_product.price, 0)::numeric, 2);
    END IF;

    v_line_total := round(v_unit * v_qty, 2);
    v_total := v_total + v_line_total;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'quantity', v_qty,
        'unit_price', v_unit,
        'line_total', v_line_total
      )
    );
  END LOOP;

  IF v_total < 0 THEN
    RETURN jsonb_build_object('status', 'invalid_total');
  END IF;

  -- En genérico el total sentinel 0 NO implica waived.
  v_pricing_pending := true;

  INSERT INTO public.pharmacy_order_counters (pharmacy_id, last_number, updated_at)
  VALUES (v_ep.pharmacy_id, 0, pg_catalog.now())
  ON CONFLICT (pharmacy_id) DO NOTHING;

  UPDATE public.pharmacy_order_counters
  SET
    last_number = last_number + 1,
    updated_at = pg_catalog.now()
  WHERE pharmacy_id = v_ep.pharmacy_id
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
    client_request_id,
    customer_name,
    customer_phone,
    privacy_accepted_at,
    customer_note
  )
  VALUES (
    v_ep.pharmacy_id,
    v_next,
    v_display,
    'public_qr',
    NULL,
    NULL,
    'request_pending',
    'pending_confirmation',
    v_total,
    'EUR',
    v_request_id,
    v_name,
    v_phone,
    pg_catalog.now(),
    v_note
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
    v_ep.pharmacy_id,
    (elem->>'product_id')::uuid,
    elem->>'product_name',
    (elem->>'quantity')::integer,
    (elem->>'unit_price')::numeric,
    (elem->>'line_total')::numeric
  FROM jsonb_array_elements(v_lines) AS elem;

  -- Respuesta pública: sin pharmacy_id, sin teléfono, sin nombre.
  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'display_number', v_display,
    'order_number', v_next,
    'order_status', 'request_pending',
    'payment_status', 'pending_confirmation',
    'pricing_pending', v_pricing_pending,
    'total_amount', v_total,
    'currency', 'EUR',
    'pharmacy_name', v_pharmacy_name,
    'catalog_mode', v_mode,
    'items_count', jsonb_array_length(v_lines)
  );
END;
$$;

COMMENT ON FUNCTION public.ff_public_catalog_create_request_v1(text, jsonb, text, text, text, boolean, text) IS
  'Solicitud QR por public_id. Gate sin kiosk. status=request_pending, payment=pending_confirmation. Sin SMS/OTP.';

REVOKE ALL ON FUNCTION public.ff_public_catalog_create_request_v1(text, jsonb, text, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_public_catalog_create_request_v1(text, jsonb, text, text, text, boolean, text)
  TO anon, authenticated, service_role;

-- =============================================================================
-- DOWN (manual)
-- DROP FUNCTION IF EXISTS public.ff_public_catalog_create_request_v1(text, jsonb, text, text, text, boolean, text);
-- DROP FUNCTION IF EXISTS public.ff_public_catalog_request_allowed(uuid);
-- -- Restaurar cuerpos 040 de transition_allowed si se revierte.
-- DROP INDEX IF EXISTS public.pharmacy_orders_public_phone_created_idx;
-- ALTER TABLE public.pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_public_qr_contact_chk;
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS customer_note;
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS privacy_accepted_at;
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS customer_phone;
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS customer_name;
-- ALTER TABLE public.pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_payment_status_chk;
-- ALTER TABLE public.pharmacy_orders ADD CONSTRAINT pharmacy_orders_payment_status_chk CHECK (
--   payment_status = ANY (ARRAY['unpaid','paid','refunded','waived']::text[])
-- );
-- ALTER TABLE public.pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_status_chk;
-- ALTER TABLE public.pharmacy_orders ADD CONSTRAINT pharmacy_orders_status_chk CHECK (
--   status = ANY (ARRAY['pending_payment','preparing','ready','delivered','cancelled']::text[])
-- );
-- ALTER TABLE public.pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_source_chk;
-- ALTER TABLE public.pharmacy_orders ADD CONSTRAINT pharmacy_orders_source_chk CHECK (
--   source = ANY (ARRAY['kiosk','counter','online','other']::text[])
-- );
-- =============================================================================
