-- =============================================================================
-- 052_commercial_security_hardening_v1.sql
-- Endurece el perímetro comercial creado en 047–051.
--
-- Problemas que corrige:
--   1) Support (platform.commercial_tariffs.read) podía SELECT * de
--      commercial_tariff_versions e incluir costes internos / snapshot sensible.
--      Postgres RLS es por fila, no por columna; SuperAdmin y Support comparten
--      el rol JWT `authenticated`, así que no basta con GRANT por columna.
--   2) Privilegios por defecto de Supabase dejaron ALL / EXECUTE en anon
--      (y a menudo PUBLIC) sobre tablas y funciones comerciales.
--
-- Diseño:
--   A) Tabla base commercial_tariff_versions:
--        SELECT solo con platform.commercial_tariffs.write (SuperAdmin).
--   B) Vista commercial_tariff_versions_commercial: proyección sin costes
--      (referencia/service_role). Clientes authenticated SIN SELECT en la vista.
--   C) RPCs DEFINER:
--        - ff_list_commercial_tariff_versions_commercial_v1 (read|write, sin costes)
--        - ff_list/get_*_internal_v1 (solo write, con costes)
--   D) Helper jsonb + trigger quotes para strip de claves internas.
--   E) REVOKE ALL FROM PUBLIC/anon; GRANT mínimo a authenticated + service_role.
--   F) SELECT RLS en commercial_tariff_versions: solo commercial_tariffs.write.
--
-- NO modifica 047–051. NO APLICAR sin autorización expresa.
-- NO toca producción por sí sola: requiere staging-psql / approval.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Helper: strip de claves internas en jsonb
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_jsonb_strip_internal(p_doc jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_doc IS NULL THEN '{}'::jsonb
    WHEN jsonb_typeof(p_doc) <> 'object' THEN '{}'::jsonb
    ELSE
      (
        p_doc
        - 'kiosk_internal_cost_cents'
        - 'kiosk_cost_personalization_cents'
        - 'kiosk_cost_shipping_cents'
        - 'kiosk_cost_configuration_cents'
        - 'kiosk_cost_other_cents'
        - 'internal_costs'
        - 'internal'
        - 'margins'
        - 'margin_cents'
        - 'kiosk_margin_cents'
      )
      -- Si existe un objeto anidado internal/*, elimínalo entero (ya cubierto por - 'internal')
  END;
$$;

COMMENT ON FUNCTION public.ff_commercial_jsonb_strip_internal(jsonb) IS
  'Elimina claves de costes/márgenes internos de snapshots comerciales. Uso en vistas y triggers.';

REVOKE ALL ON FUNCTION public.ff_commercial_jsonb_strip_internal(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_commercial_jsonb_strip_internal(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_commercial_jsonb_strip_internal(jsonb)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1) Vista comercial segura (sin costes / márgenes)
--    Acceso a la tabla subyacente como owner de la vista (sin FORCE RLS),
--    por lo que Support no necesita SELECT en la tabla base.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.commercial_tariff_versions_commercial
AS
SELECT
  v.id,
  v.version_label,
  v.is_current,
  v.vat_bps,
  v.saas_annual_discount_bps,
  v.kiosk_license_annual_discount_bps,
  v.kiosk_hardware_unit_cents,
  v.kiosk_license_monthly_cents,
  v.default_onsite_install_cents,
  public.ff_commercial_jsonb_strip_internal(v.snapshot) AS snapshot,
  v.notes,
  v.created_by,
  v.created_at
FROM public.commercial_tariff_versions v;

COMMENT ON VIEW public.commercial_tariff_versions_commercial IS
  'Proyección sin costes (referencia). Clientes: usar ff_list_commercial_tariff_versions_commercial_v1(). SuperAdmin costes: ff_*_internal_v1 / tabla base con .write.';

-- Acceso Support/lectura comercial: SOLO vía RPC SECURITY DEFINER.
-- Motivo: Support y farmacias comparten rol JWT `authenticated`; un GRANT
-- SELECT en la vista expondría precios a cualquier usuario vía PostgREST.
-- La RPC re-valida platform.commercial_tariffs.read|write y proyecta sin costes.
CREATE OR REPLACE FUNCTION public.ff_list_commercial_tariff_versions_commercial_v1()
RETURNS TABLE (
  id uuid,
  version_label text,
  is_current boolean,
  vat_bps integer,
  saas_annual_discount_bps integer,
  kiosk_license_annual_discount_bps integer,
  kiosk_hardware_unit_cents bigint,
  kiosk_license_monthly_cents bigint,
  default_onsite_install_cents bigint,
  snapshot jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.ff_has_platform_permission('platform.commercial_tariffs.read')
    OR public.ff_has_platform_permission('platform.commercial_tariffs.write')
  ) THEN
    RAISE EXCEPTION 'forbidden_commercial_tariffs_read' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.version_label,
    v.is_current,
    v.vat_bps,
    v.saas_annual_discount_bps,
    v.kiosk_license_annual_discount_bps,
    v.kiosk_hardware_unit_cents,
    v.kiosk_license_monthly_cents,
    v.default_onsite_install_cents,
    public.ff_commercial_jsonb_strip_internal(v.snapshot) AS snapshot,
    v.notes,
    v.created_by,
    v.created_at
  FROM public.commercial_tariff_versions v
  ORDER BY v.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.ff_list_commercial_tariff_versions_commercial_v1() IS
  'Lista versiones sin costes internos. SECURITY DEFINER + check read|write.';

-- SuperAdmin: lectura completa (con costes). DEFINER + check write.
CREATE OR REPLACE FUNCTION public.ff_get_commercial_tariff_version_internal_v1(
  p_version_id uuid
)
RETURNS public.commercial_tariff_versions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.commercial_tariff_versions%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_tariffs.write') THEN
    RAISE EXCEPTION 'forbidden_commercial_tariffs_internal' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.commercial_tariff_versions
  WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commercial_tariff_version_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.ff_get_commercial_tariff_version_internal_v1(uuid) IS
  'Versión CON costes internos. Solo platform.commercial_tariffs.write.';

CREATE OR REPLACE FUNCTION public.ff_list_commercial_tariff_versions_internal_v1()
RETURNS SETOF public.commercial_tariff_versions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_tariffs.write') THEN
    RAISE EXCEPTION 'forbidden_commercial_tariffs_internal' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT v.*
  FROM public.commercial_tariff_versions v
  ORDER BY v.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.ff_list_commercial_tariff_versions_internal_v1() IS
  'Lista versiones CON costes internos. Solo platform.commercial_tariffs.write.';

-- -----------------------------------------------------------------------------
-- 2) RLS: SELECT en tabla base solo SuperAdmin (write)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS commercial_tariff_versions_select ON public.commercial_tariff_versions;

CREATE POLICY commercial_tariff_versions_select_internal ON public.commercial_tariff_versions
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_tariffs.write'));

-- INSERT / UPDATE meta ya exigen write (047); se mantienen.

-- -----------------------------------------------------------------------------
-- 3) Trigger: no persistir costes internos dentro de snapshots de presupuestos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_quotes_strip_internal_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.snapshot := public.ff_commercial_jsonb_strip_internal(NEW.snapshot);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_quotes_strip_internal_snapshot ON public.commercial_quotes;
CREATE TRIGGER commercial_quotes_strip_internal_snapshot
  BEFORE INSERT OR UPDATE OF snapshot ON public.commercial_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_commercial_quotes_strip_internal_snapshot();

-- Sanea filas existentes (idempotente; no toca importes monetarios)
UPDATE public.commercial_quotes q
SET snapshot = public.ff_commercial_jsonb_strip_internal(q.snapshot)
WHERE q.snapshot IS NOT NULL
  AND q.snapshot <> public.ff_commercial_jsonb_strip_internal(q.snapshot);

-- -----------------------------------------------------------------------------
-- 4) ACL de tablas comerciales: mínimo privilegio
--    (Supabase default privileges suelen dejar ALL a anon/authenticated)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  tables text[] := ARRAY[
    'commercial_plan_skus',
    'commercial_tariff_versions',
    'commercial_plan_price_versions',
    'commercial_quotes',
    'commercial_quote_lines',
    'pharmacy_commercial_trials'
  ];
BEGIN
  FOREACH r IN ARRAY tables
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r);
    -- service_role: acceso backend legítimo (bypassa RLS)
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', r);
  END LOOP;
END;
$$;

-- authenticated: solo lo que RLS + RPCs necesitan
GRANT SELECT, INSERT, UPDATE ON public.commercial_plan_skus TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commercial_tariff_versions TO authenticated;
GRANT SELECT, INSERT ON public.commercial_plan_price_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commercial_quotes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.commercial_quote_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pharmacy_commercial_trials TO authenticated;

-- Vista: referencia/documentación + uso service_role. Clientes NO tienen
-- SELECT (evitar fuga PostgREST a farmacias authenticated). Lectura Support
-- solo vía ff_list_commercial_tariff_versions_commercial_v1().
REVOKE ALL ON public.commercial_tariff_versions_commercial FROM PUBLIC;
REVOKE ALL ON public.commercial_tariff_versions_commercial FROM anon;
REVOKE ALL ON public.commercial_tariff_versions_commercial FROM authenticated;
GRANT SELECT ON public.commercial_tariff_versions_commercial TO service_role;

-- -----------------------------------------------------------------------------
-- 5) ACL de funciones comerciales: sin anon/PUBLIC
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'ff_commercial%'
        OR p.proname LIKE 'ff_publish_commercial%'
        OR p.proname LIKE 'ff_create_pharmacy_commercial%'
        OR p.proname LIKE 'ff_list_commercial_tariff%'
        OR p.proname LIKE 'ff_get_commercial_tariff%'
        OR p.proname = 'ff_pharmacy_has_current_subscription'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.regproc);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.regproc);
    -- Trigger helpers: no necesitan EXECUTE de clientes
    IF fn.regproc::text LIKE 'ff_commercial_quotes_protect_immutable%'
       OR fn.regproc::text LIKE 'ff_commercial_quotes_strip_internal_snapshot%'
    THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn.regproc);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn.regproc);
    ELSE
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        fn.regproc
      );
    END IF;
  END LOOP;
END;
$$;

-- Asegura grants explícitos de las RPCs nuevas (por si el loop no cubre alias)
REVOKE ALL ON FUNCTION public.ff_list_commercial_tariff_versions_commercial_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_list_commercial_tariff_versions_commercial_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_list_commercial_tariff_versions_commercial_v1()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ff_list_commercial_tariff_versions_internal_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_list_commercial_tariff_versions_internal_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_list_commercial_tariff_versions_internal_v1()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ff_get_commercial_tariff_version_internal_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_get_commercial_tariff_version_internal_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_get_commercial_tariff_version_internal_v1(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) Comentarios de contrato de acceso
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.commercial_tariff_versions IS
  'Versiones de tarifa. Costes internos: solo SuperAdmin (SELECT policy = commercial_tariffs.write). Support: usar ff_list_commercial_tariff_versions_commercial_v1().';

COMMENT ON COLUMN public.commercial_tariff_versions.kiosk_internal_cost_cents IS
  'Coste interno hardware. Nunca exponer a Support/farmacias/PDF comercial.';
COMMENT ON COLUMN public.commercial_tariff_versions.kiosk_cost_personalization_cents IS
  'Coste interno. Solo SuperAdmin.';
COMMENT ON COLUMN public.commercial_tariff_versions.kiosk_cost_shipping_cents IS
  'Coste interno. Solo SuperAdmin.';
COMMENT ON COLUMN public.commercial_tariff_versions.kiosk_cost_configuration_cents IS
  'Coste interno. Solo SuperAdmin.';
COMMENT ON COLUMN public.commercial_tariff_versions.kiosk_cost_other_cents IS
  'Coste interno. Solo SuperAdmin.';

-- =============================================================================
-- VERIFICACIÓN (ejecutar tras apply; no forma parte del deploy automático)
-- =============================================================================
-- -- A) ACL tablas: anon no debe tener privilegios
-- SELECT c.relname,
--        CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee,
--        a.privilege_type
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
-- LEFT JOIN pg_roles r ON r.oid = a.grantee
-- WHERE n.nspname = 'public'
--   AND c.relname IN (
--     'commercial_plan_skus','commercial_tariff_versions','commercial_plan_price_versions',
--     'commercial_quotes','commercial_quote_lines','pharmacy_commercial_trials'
--   )
--   AND (a.grantee = 0 OR r.rolname = 'anon');
-- -- Esperado: 0 filas
--
-- -- B) ACL funciones: anon/PUBLIC sin EXECUTE (excepto si alguna queda 0)
-- SELECT p.proname,
--        CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE coalesce(r.rolname, '?') END AS grantee
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
-- LEFT JOIN pg_roles r ON r.oid = a.grantee
-- WHERE n.nspname = 'public'
--   AND (p.proname LIKE 'ff_commercial%' OR p.proname LIKE 'ff_publish_commercial%'
--        OR p.proname LIKE 'ff_create_pharmacy_commercial%'
--        OR p.proname LIKE 'ff_list_commercial_tariff%'
--        OR p.proname LIKE 'ff_get_commercial_tariff%'
--        OR p.proname = 'ff_pharmacy_has_current_subscription')
--   AND (a.grantee = 0 OR r.rolname = 'anon');
-- -- Esperado: 0 filas
--
-- -- C) Política SELECT base = solo write
-- SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid)
-- FROM pg_policy pol
-- JOIN pg_class c ON c.oid = pol.polrelid
-- WHERE c.relname = 'commercial_tariff_versions' AND pol.polcmd = 'r';
--
-- -- D) Vista sin columnas de coste
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'commercial_tariff_versions_commercial'
--   AND column_name LIKE '%cost%';
-- -- Esperado: 0 filas
--
-- -- E) RLS sigue activo
-- SELECT c.relname, c.relrowsecurity
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relname LIKE 'commercial%';
--
-- -- F) Manual con JWT Support vs SuperAdmin (fuera de psql service):
-- --   Support: SELECT * FROM commercial_tariff_versions → 0 filas / error policy
-- --   Support: SELECT ff_list_commercial_tariff_versions_commercial_v1() → OK sin costes
-- --   Support: SELECT ff_list_commercial_tariff_versions_internal_v1() → 42501
-- --   SuperAdmin: SELECT * FROM commercial_tariff_versions → filas con costes
-- --   SuperAdmin: ff_get_commercial_tariff_version_internal_v1(id) → OK
-- --   Farmacia authenticated sin platform perms: ambas RPC → 42501
-- --   anon: EXECUTE RPC → permission denied
--
-- =============================================================================
-- DOWN (manual, desarrollo):
-- DROP TRIGGER IF EXISTS commercial_quotes_strip_internal_snapshot ON public.commercial_quotes;
-- DROP FUNCTION IF EXISTS public.ff_commercial_quotes_strip_internal_snapshot();
-- DROP FUNCTION IF EXISTS public.ff_get_commercial_tariff_version_internal_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_list_commercial_tariff_versions_internal_v1();
-- DROP FUNCTION IF EXISTS public.ff_list_commercial_tariff_versions_commercial_v1();
-- DROP VIEW IF EXISTS public.commercial_tariff_versions_commercial;
-- DROP FUNCTION IF EXISTS public.ff_commercial_jsonb_strip_internal(jsonb);
-- DROP POLICY IF EXISTS commercial_tariff_versions_select_internal ON public.commercial_tariff_versions;
-- -- Restaurar política 047 commercial_tariff_versions_select (read OR write) si se revierte.
-- =============================================================================
