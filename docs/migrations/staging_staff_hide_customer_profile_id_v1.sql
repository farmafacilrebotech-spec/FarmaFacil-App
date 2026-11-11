-- =============================================================================
-- STAGING ONLY — ocultar customer_profile_id a PostgREST authenticated
-- y exponer listado/ficha de clientes vía RPC con gate de rol.
-- =============================================================================
-- Objetivo:
--   - STAFF sigue leyendo datos operativos de pedidos (nombre/teléfono/nota).
--   - STAFF NO puede seleccionar customer_profile_id ni enumerar el directorio.
--   - Owner / Admin / Farmacéutico usan RPC SECURITY DEFINER.
-- Idempotente. NO aplicar en producción sin autorización expresa.
-- =============================================================================

BEGIN;

-- Helper: roles del panel Clientes (no STAFF)
CREATE OR REPLACE FUNCTION public.ff_pharmacy_can_view_linked_clients(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pharmacy_memberships m
      INNER JOIN public.roles r ON r.id = m.role_id
      WHERE m.pharmacy_id = p_pharmacy_id
        AND m.profile_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND r.key = ANY (ARRAY[
          'PHARMACY_OWNER'::text,
          'PHARMACY_ADMIN'::text,
          'PHARMACIST'::text
        ])
    )
    AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'orders.view');
$$;

REVOKE ALL ON FUNCTION public.ff_pharmacy_can_view_linked_clients(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_can_view_linked_clients(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.ff_pharmacy_can_view_linked_clients(uuid) IS
  'True si el actor tiene membership Owner/Admin/Farmacéutico activa y orders.view.';

-- Listado agregado de clientes vinculados (solo esa farmacia)
CREATE OR REPLACE FUNCTION public.ff_list_pharmacy_linked_clients_v1(
  p_pharmacy_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
  v_rows jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT public.ff_pharmacy_can_view_linked_clients(p_pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  WITH linked AS (
    SELECT
      o.customer_profile_id,
      NULLIF(btrim(o.customer_name), '') AS customer_name,
      NULLIF(btrim(o.customer_phone), '') AS customer_phone,
      o.created_at
    FROM public.pharmacy_orders o
    WHERE o.pharmacy_id = p_pharmacy_id
      AND o.customer_profile_id IS NOT NULL
  ),
  agg AS (
    SELECT
      customer_profile_id,
      COALESCE(
        (ARRAY_AGG(customer_name ORDER BY created_at DESC)
          FILTER (WHERE customer_name IS NOT NULL))[1],
        'Cliente'
      ) AS display_name,
      (ARRAY_AGG(customer_phone ORDER BY created_at DESC)
        FILTER (WHERE customer_phone IS NOT NULL))[1] AS phone,
      MIN(created_at) AS first_linked_at,
      MAX(created_at) AS last_order_at,
      COUNT(*)::int AS order_count
    FROM linked
    GROUP BY customer_profile_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'customerProfileId', customer_profile_id,
        'displayName', display_name,
        'phone', phone,
        'firstLinkedAt', first_linked_at,
        'lastOrderAt', last_order_at,
        'orderCount', order_count
      )
      ORDER BY last_order_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT * FROM agg ORDER BY last_order_at DESC LIMIT v_limit
  ) s;

  RETURN jsonb_build_object('status', 'ok', 'clients', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_list_pharmacy_linked_clients_v1(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_list_pharmacy_linked_clients_v1(uuid, integer)
  TO authenticated, service_role;

-- Ficha + pedidos de un cliente en ESA farmacia
CREATE OR REPLACE FUNCTION public.ff_get_pharmacy_linked_client_v1(
  p_pharmacy_id uuid,
  p_customer_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_client jsonb;
  v_orders jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT public.ff_pharmacy_can_view_linked_clients(p_pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF p_customer_profile_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  WITH rows AS (
    SELECT
      o.id,
      o.display_number,
      o.status,
      o.source,
      o.total_amount,
      o.currency,
      o.amount_confirmed_at,
      o.created_at,
      NULLIF(btrim(o.customer_name), '') AS customer_name,
      NULLIF(btrim(o.customer_phone), '') AS customer_phone
    FROM public.pharmacy_orders o
    WHERE o.pharmacy_id = p_pharmacy_id
      AND o.customer_profile_id = p_customer_profile_id
    ORDER BY o.created_at DESC
    LIMIT 100
  )
  SELECT
    CASE WHEN COUNT(*) = 0 THEN NULL ELSE
      jsonb_build_object(
        'customerProfileId', p_customer_profile_id,
        'displayName', COALESCE(
          (ARRAY_AGG(customer_name ORDER BY created_at DESC)
            FILTER (WHERE customer_name IS NOT NULL))[1],
          'Cliente'
        ),
        'phone', (ARRAY_AGG(customer_phone ORDER BY created_at DESC)
          FILTER (WHERE customer_phone IS NOT NULL))[1],
        'firstLinkedAt', MIN(created_at),
        'lastOrderAt', MAX(created_at),
        'orderCount', COUNT(*)::int
      )
    END,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'displayNumber', display_number,
          'status', status,
          'source', COALESCE(source, 'other'),
          'totalAmount', COALESCE(total_amount, 0),
          'currency', COALESCE(currency, 'EUR'),
          'amountConfirmedAt', amount_confirmed_at,
          'createdAt', created_at,
          'customerName', customer_name,
          'customerPhone', customer_phone
        )
        ORDER BY created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_client, v_orders
  FROM rows;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'client', v_client,
    'orders', v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_get_pharmacy_linked_client_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_get_pharmacy_linked_client_v1(uuid, uuid)
  TO authenticated, service_role;

-- Columna de vínculo: no legible por JWT authenticated/anon (sí por SECURITY DEFINER / service_role)
REVOKE SELECT (customer_profile_id) ON public.pharmacy_orders FROM authenticated;
REVOKE SELECT (customer_profile_id) ON public.pharmacy_orders FROM anon;

INSERT INTO public._ff_staging_recovery_log (label, detail)
VALUES (
  'staff_hide_customer_profile_id_v1',
  jsonb_build_object(
    'revoked_column', 'pharmacy_orders.customer_profile_id',
    'rpcs', jsonb_build_array(
      'ff_list_pharmacy_linked_clients_v1',
      'ff_get_pharmacy_linked_client_v1'
    )
  )
);

COMMIT;
