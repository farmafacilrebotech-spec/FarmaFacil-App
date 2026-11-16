-- =============================================================================
-- 098_cli_public_branding_order_items_rls_v1.sql
-- Correcciones CLI (área cliente / pedidos) promovidas a migración oficial.
-- Fuente de verdad: esquema staging dazfdcjscnpfvhcyjddt (dump 2026-11-16) +
-- docs/migrations/staging_cli_customer_area_fixes_20261116.sql
--
-- Cubre:
--   - visible_name + logo_url en ff_resolve_public_entrypoint_v1
--   - Mis farmacias: saved_at + logo + visible_name + dual-role
--   - ff_order_linked_to_auth_uid + policy items (compatible staff_hide)
--   - Mis pedidos enriquecido (farmacia, logo, conteos)
--
-- Idempotente vía CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- NO APLICAR en producción sin autorización.
-- Dependencias: 044, 064, 067, 071, 072, staff_hide v1/v1b (si aplica).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Resolve público: visible_name + logo_url
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_resolve_public_entrypoint_v1(
  p_public_id text
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
  v_logo_url text;
BEGIN
  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id IS NULL OR v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT *
  INTO v_ep
  FROM public.public_entrypoints
  WHERE public_id = v_id
    AND purpose = 'pharmacy_home'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_ep.is_active IS NOT TRUE
     OR (v_ep.expires_at IS NOT NULL AND v_ep.expires_at <= pg_catalog.now()) THEN
    RETURN jsonb_build_object('status', 'inactive');
  END IF;

  SELECT COALESCE(NULLIF(btrim(ps.visible_name), ''), p.name)
  INTO v_pharmacy_name
  FROM public.pharmacies p
  LEFT JOIN public.pharmacy_settings ps ON ps.pharmacy_id = p.id
  WHERE p.id = v_ep.pharmacy_id;

  IF v_pharmacy_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT nullif(btrim(pb.logo_url), '')
  INTO v_logo_url
  FROM public.pharmacy_branding pb
  WHERE pb.pharmacy_id = v_ep.pharmacy_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'public_id', v_ep.public_id,
    'pharmacy_name', v_pharmacy_name,
    'logo_url', v_logo_url
  );
END;
$$;

COMMENT ON FUNCTION public.ff_resolve_public_entrypoint_v1(text) IS
  'Resuelve public_id pharmacy_home. Respuesta: status, public_id, pharmacy_name, logo_url opcional.';

REVOKE ALL ON FUNCTION public.ff_resolve_public_entrypoint_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_resolve_public_entrypoint_v1(text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) Mis farmacias: saved_at + logo + visible_name + dual-role
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_customer_list_saved_pharmacies_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid
      AND public.ff_profile_is_customer_kind(p.account_kind)
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'pharmacy_id', s.pharmacy_id,
          'public_id', s.public_id,
          'pharmacy_name', COALESCE(NULLIF(btrim(ps.visible_name), ''), p.name),
          'logo_url', nullif(btrim(pb.logo_url), ''),
          'saved_at', s.saved_at
        )
        ORDER BY s.saved_at DESC
      )
      FROM public.customer_saved_pharmacies s
      JOIN public.pharmacies p ON p.id = s.pharmacy_id
      LEFT JOIN public.pharmacy_settings ps ON ps.pharmacy_id = s.pharmacy_id
      LEFT JOIN public.pharmacy_branding pb ON pb.pharmacy_id = s.pharmacy_id
      WHERE s.profile_id = v_uid
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_customer_list_saved_pharmacies_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_customer_list_saved_pharmacies_v1()
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Pedidos: helper DEFINER + policy items (staff_hide compatible)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_order_linked_to_auth_uid(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pharmacy_orders o
    WHERE o.id = p_order_id
      AND o.customer_profile_id IS NOT NULL
      AND o.customer_profile_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.ff_order_linked_to_auth_uid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_order_linked_to_auth_uid(uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS pharmacy_order_items_select_own_customer ON public.pharmacy_order_items;
CREATE POLICY pharmacy_order_items_select_own_customer ON public.pharmacy_order_items
  FOR SELECT TO authenticated
  USING (public.ff_order_linked_to_auth_uid(order_id));

-- -----------------------------------------------------------------------------
-- 4) Mis pedidos: farmacia + logo + conteos
-- -----------------------------------------------------------------------------
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

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'account_kind'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
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
        'pharmacyName', s.pharmacy_name,
        'pharmacyLogoUrl', s.logo_url,
        'displayNumber', s.display_number,
        'status', s.status,
        'source', COALESCE(s.source, 'other'),
        'paymentStatus', COALESCE(s.payment_status, 'unpaid'),
        'totalAmount', COALESCE(s.total_amount, 0),
        'currency', COALESCE(s.currency, 'EUR'),
        'amountConfirmedAt', s.amount_confirmed_at,
        'createdAt', s.created_at,
        'customerName', NULLIF(btrim(s.customer_name), ''),
        'productCount', s.product_count,
        'unitCount', s.unit_count
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
      COALESCE(NULLIF(btrim(ps.visible_name), ''), p.name) AS pharmacy_name,
      nullif(btrim(pb.logo_url), '') AS logo_url,
      o.display_number,
      o.status,
      o.source,
      o.payment_status,
      o.total_amount,
      o.currency,
      o.amount_confirmed_at,
      o.created_at,
      o.customer_name,
      (SELECT COUNT(*)::int FROM public.pharmacy_order_items i WHERE i.order_id = o.id) AS product_count,
      (SELECT COALESCE(SUM(i.quantity), 0)::int FROM public.pharmacy_order_items i WHERE i.order_id = o.id) AS unit_count
    FROM public.pharmacy_orders o
    JOIN public.pharmacies p ON p.id = o.pharmacy_id
    LEFT JOIN public.pharmacy_settings ps ON ps.pharmacy_id = o.pharmacy_id
    LEFT JOIN public.pharmacy_branding pb ON pb.pharmacy_id = o.pharmacy_id
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
  'Lista pedidos del auth.uid() vinculado; incluye farmacia/logo/conteos; no expone customer_profile_id por PostgREST.';
