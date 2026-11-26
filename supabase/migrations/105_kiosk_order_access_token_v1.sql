-- =============================================================================
-- 105_kiosk_order_access_token_v1.sql
-- E2 (mínimo): token opaco de consulta de pedido kiosko → /o/{token}
-- + pedidos kiosko con líneas a PVP 0 (pendiente de valoración).
--
-- No reactiva claim por teléfono. No almacena plaintext del token.
-- Depende de: 040, 062 (ff_hash_quote_token_v1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabla de tokens de acceso a pedido
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_order_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.pharmacy_orders (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'status_view',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_order_access_tokens_hash_format_chk
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT pharmacy_order_access_tokens_purpose_chk
    CHECK (purpose = ANY (ARRAY['status_view', 'claim_link']))
);

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_order_access_tokens_hash_uid
  ON public.pharmacy_order_access_tokens (token_hash);

CREATE INDEX IF NOT EXISTS pharmacy_order_access_tokens_order_idx
  ON public.pharmacy_order_access_tokens (order_id, created_at DESC);

COMMENT ON TABLE public.pharmacy_order_access_tokens IS
  'Tokens opacos de consulta/vinculación de pedido (E2). Solo SHA-256 hex; plaintext nunca en BD.';

ALTER TABLE public.pharmacy_order_access_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pharmacy_order_access_tokens
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_order_access_tokens
  TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Emitir token (sesión kiosko autenticada por credential_hash)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_issue_order_access_token_v1(
  p_credential_hash text,
  p_order_id uuid,
  p_token_plaintext text
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
  v_hash text;
  v_token_id uuid;
  v_expires timestamptz;
BEGIN
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0
     OR p_order_id IS NULL
     OR p_token_plaintext IS NULL
     OR length(p_token_plaintext) < 43
     OR length(p_token_plaintext) > 128
     OR p_token_plaintext ~ '\s' THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  SELECT * INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = btrim(p_credential_hash)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  SELECT * INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_order.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id
     OR v_order.device_id IS DISTINCT FROM v_device.id THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_order.source IS DISTINCT FROM 'kiosk' THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  v_hash := public.ff_hash_quote_token_v1(p_token_plaintext);
  v_expires := pg_catalog.now() + interval '90 days';

  -- Un solo activo por pedido: revocar anteriores de status_view.
  UPDATE public.pharmacy_order_access_tokens
  SET revoked_at = pg_catalog.now()
  WHERE order_id = v_order.id
    AND purpose = 'status_view'
    AND revoked_at IS NULL
    AND consumed_at IS NULL;

  INSERT INTO public.pharmacy_order_access_tokens (
    pharmacy_id,
    order_id,
    token_hash,
    purpose,
    expires_at
  )
  VALUES (
    v_order.pharmacy_id,
    v_order.id,
    v_hash,
    'status_view',
    v_expires
  )
  RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'token_id', v_token_id,
    'order_id', v_order.id,
    'display_number', v_order.display_number,
    'expires_at', v_expires
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_issue_order_access_token_v1(text, uuid, text) IS
  'Emite token opaco de consulta de pedido kiosko (solo hash en BD).';

REVOKE ALL ON FUNCTION public.ff_kiosk_issue_order_access_token_v1(text, uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_issue_order_access_token_v1(text, uuid, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Consulta pública por token (sin PII de otros clientes)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_get_order_by_access_token_v1(
  p_token_plaintext text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hash text;
  v_tok public.pharmacy_order_access_tokens%ROWTYPE;
  v_order public.pharmacy_orders%ROWTYPE;
  v_pharmacy_name text;
  v_items jsonb;
BEGIN
  IF p_token_plaintext IS NULL
     OR length(btrim(p_token_plaintext)) < 43
     OR length(p_token_plaintext) > 128 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  v_hash := public.ff_hash_quote_token_v1(btrim(p_token_plaintext));

  SELECT * INTO v_tok
  FROM public.pharmacy_order_access_tokens
  WHERE token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_tok.revoked_at IS NOT NULL OR v_tok.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = v_tok.order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT COALESCE(
    nullif(btrim(ps.visible_name), ''),
    nullif(btrim(p.name), ''),
    'Farmacia'
  )
  INTO v_pharmacy_name
  FROM public.pharmacies p
  LEFT JOIN public.pharmacy_settings ps ON ps.pharmacy_id = p.id
  WHERE p.id = v_order.pharmacy_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_name', i.product_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total
      )
      ORDER BY i.created_at
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.pharmacy_order_items i
  WHERE i.order_id = v_order.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'order', jsonb_build_object(
      'display_number', v_order.display_number,
      'order_status', v_order.status,
      'payment_status', v_order.payment_status,
      'total_amount', v_order.total_amount,
      'currency', COALESCE(v_order.currency, 'EUR'),
      'pharmacy_name', COALESCE(v_pharmacy_name, 'Farmacia'),
      'created_at', v_order.created_at,
      'items', v_items
    )
  );
END;
$$;

COMMENT ON FUNCTION public.ff_get_order_by_access_token_v1(text) IS
  'Consulta pública de pedido por token opaco (E2). Sin teléfonos ni PII ajena.';

REVOKE ALL ON FUNCTION public.ff_get_order_by_access_token_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_get_order_by_access_token_v1(text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Permitir total 0 en pedidos kiosko (PVP pendiente de valoración)
--     Reemplaza solo el chequeo de total; resto de la función = 040.
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
  v_pending_count integer := 0;
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

    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN
      RETURN jsonb_build_object('status', 'invalid_quantity');
    END IF;

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

    -- PVP 0 = pendiente de valoración (no gratuito implícito).
    IF v_product.price IS NULL OR v_product.price < 0 THEN
      RETURN jsonb_build_object(
        'status', 'invalid_cart',
        'product_id', v_product_id
      );
    END IF;

    IF v_product.price = 0 THEN
      v_pending_count := v_pending_count + 1;
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

  -- Permite total 0 si hay líneas (todas pendientes de valoración).
  IF v_total < 0 THEN
    RETURN jsonb_build_object('status', 'invalid_total');
  END IF;

  IF jsonb_array_length(v_lines) = 0 THEN
    RETURN jsonb_build_object('status', 'empty_cart');
  END IF;

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
    'items', v_lines,
    'pending_valuation_lines', v_pending_count
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_create_order_v1(text, jsonb, text) IS
  'Crea pedido kiosko. PVP 0 permitido (pendiente valoración). Precios servidor; idempotente.';
