-- =============================================================================
-- STAGING — complemento v1c: pedidos del área cliente sin SELECT customer_profile_id
-- Depende de: v1 + v1b (column grants sin customer_profile_id).
-- El listado cliente no puede filtrar por customer_profile_id vía PostgREST.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ff_list_my_customer_orders_v1(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  -- Capacidad cliente: account_kind si existe; si no, basta auth.uid()
  -- (la app ya hace gate de perfil antes de llamar la RPC).
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'account_kind'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = v_uid
        AND COALESCE(p.account_kind::text, '') IN ('customer', 'both')
    ) THEN
      RETURN jsonb_build_object('status', 'forbidden');
    END IF;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'pharmacyId', s.pharmacy_id,
        'displayNumber', s.display_number,
        'status', s.status,
        'source', COALESCE(s.source, 'other'),
        'paymentStatus', COALESCE(s.payment_status, 'unpaid'),
        'totalAmount', COALESCE(s.total_amount, 0),
        'currency', COALESCE(s.currency, 'EUR'),
        'amountConfirmedAt', s.amount_confirmed_at,
        'createdAt', s.created_at,
        'customerName', NULLIF(btrim(s.customer_name), '')
      )
      ORDER BY s.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      o.id,
      o.pharmacy_id,
      o.display_number,
      o.status,
      o.source,
      o.payment_status,
      o.total_amount,
      o.currency,
      o.amount_confirmed_at,
      o.created_at,
      o.customer_name
    FROM public.pharmacy_orders o
    WHERE o.customer_profile_id = v_uid
    ORDER BY o.created_at DESC
    LIMIT v_limit
  ) s;

  RETURN jsonb_build_object('status', 'ok', 'orders', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_list_my_customer_orders_v1(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_list_my_customer_orders_v1(integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.ff_list_my_customer_orders_v1(integer) IS
  'Lista pedidos del auth.uid() vinculado; no expone customer_profile_id por PostgREST.';

INSERT INTO public._ff_staging_recovery_log (label, detail)
VALUES (
  'staff_hide_customer_profile_id_v1c',
  jsonb_build_object('rpc', 'ff_list_my_customer_orders_v1')
);

COMMIT;
