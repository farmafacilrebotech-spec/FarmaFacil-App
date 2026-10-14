-- =============================================================================
-- 032_operational_select_requires_operable_v1.sql
-- SELECT de datos operativos: tenant solo si la farmacia es operable.
--
-- Bloquea PostgREST de catálogo/config operativa con sesión tenant cuando la
-- farmacia está comercialmente bloqueada.
--
-- CONSERVA (sin exigir operable) para auth / soft-lock / SuperAdmin:
--   - pharmacies_select          (ff_can_read_pharmacy) → nombre + status
--   - subscriptions_select       (member + pharmacy.view | platform)
--   - pharmacy_memberships_select (propia fila / plataforma / peers)
--   - profiles / legal / auth routes (sin cambio)
--
-- SuperAdmin: platform.pharmacies.read|write sigue leyendo todo.
-- Depende de: 028 (ff_pharmacy_is_operable).
-- NO APLICAR automáticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: lectura operativa (plataforma O member+operable)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_can_read_pharmacy_operational(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(p_pharmacy_id)
      AND public.ff_pharmacy_is_operable(p_pharmacy_id)
    );
$$;

COMMENT ON FUNCTION public.ff_can_read_pharmacy_operational(uuid) IS
  'SELECT operativo: platform pharmacies.read|write O member active + farmacia operable. No sustituye a ff_can_read_pharmacy (soft-lock).';

REVOKE ALL ON FUNCTION public.ff_can_read_pharmacy_operational(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_can_read_pharmacy_operational(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- pharmacy_products
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS pharmacy_products_select ON public.pharmacy_products;
CREATE POLICY pharmacy_products_select ON public.pharmacy_products
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy_operational(pharmacy_id));

-- -----------------------------------------------------------------------------
-- pharmacy_entitlements (capacidad operativa; no necesaria para soft-lock)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS pharmacy_entitlements_select ON public.pharmacy_entitlements;
CREATE POLICY pharmacy_entitlements_select ON public.pharmacy_entitlements
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.entitlements.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- -----------------------------------------------------------------------------
-- branding / settings / entrypoints (config operativa)
-- Soft-lock no las necesita; pharmacies + subscriptions bastan.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS pharmacy_branding_select ON public.pharmacy_branding;
CREATE POLICY pharmacy_branding_select ON public.pharmacy_branding
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy_operational(pharmacy_id));

DROP POLICY IF EXISTS pharmacy_settings_select ON public.pharmacy_settings;
CREATE POLICY pharmacy_settings_select ON public.pharmacy_settings
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy_operational(pharmacy_id));

DROP POLICY IF EXISTS public_entrypoints_select ON public.public_entrypoints;
CREATE POLICY public_entrypoints_select ON public.public_entrypoints
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy_operational(pharmacy_id));

-- -----------------------------------------------------------------------------
-- activity_events (feed operativo del tenant)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS activity_events_select ON public.activity_events;
CREATE POLICY activity_events_select ON public.activity_events
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      pharmacy_id IS NOT NULL
      AND public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'activity.view')
    )
  );

-- activity_events INSERT tenant: solo si operable (evita ruido en bloqueo)
DROP POLICY IF EXISTS activity_events_insert ON public.activity_events;
CREATE POLICY activity_events_insert ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      pharmacy_id IS NOT NULL
      AND public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- DOWN (desarrollo): restaurar policies SELECT de 012/020 y DROP helper.
