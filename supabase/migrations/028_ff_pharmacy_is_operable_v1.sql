-- =============================================================================
-- 028_ff_pharmacy_is_operable_v1.sql
-- Control de operatividad comercial de farmacia (no eludible vía PostgREST).
--
-- Separación de ejes:
--   - membership (ff_is_active_member): ¿el usuario pertenece a la farmacia?
--   - pharmacy.status: ciclo del tenant (suspended/archived bloquean)
--   - subscriptions: vigencia comercial (trial / active / past_due+gracia)
--
-- Lectura (SELECT): se mantiene con membership/plataforma para soft-lock / info.
-- Escritura operativa: exige ff_pharmacy_is_operable en el camino tenant.
-- SuperAdmin (platform.pharmacies.write) no queda bloqueado.
--
-- NO modifica login, invitaciones, first-access ni recovery (rutas Auth).
-- NO altera ff_is_active_member (sigue siendo solo membership).
--
-- Residual membership DEFINER: corregido en 031_membership_requires_pharmacy_operable_v1.
-- Accept-invitation / first-access DEFINER se dejan a propósito (no bloquear invites).
--
-- NO APLICAR automáticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ¿La suscripción corriente permite operar ahora?
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_subscription_is_valid(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.pharmacy_id = p_pharmacy_id
        AND (
          -- Trial: exige trial_end futuro (sin fecha = no operable; evita trials eternos)
          (
            s.status = 'trialing'
            AND s.trial_end IS NOT NULL
            AND s.trial_end > pg_catalog.now()
          )
          OR (
            -- Active sin cancelación programada: operable aunque no haya period_end
            s.status = 'active'
            AND s.cancel_at_period_end = false
          )
          OR (
            -- Active con cancel_at_period_end: exige period_end futuro
            s.status = 'active'
            AND s.cancel_at_period_end = true
            AND s.current_period_end IS NOT NULL
            AND s.current_period_end > pg_catalog.now()
          )
          OR (
            -- past_due: exige gracia explícita y no vencida
            s.status = 'past_due'
            AND s.grace_period_ends_at IS NOT NULL
            AND s.grace_period_ends_at > pg_catalog.now()
          )
        )
    );
$$;

COMMENT ON FUNCTION public.ff_pharmacy_subscription_is_valid(uuid) IS
  'True si hay suscripción operable: trialing con trial_end futuro; active sin cancel o con period_end futuro; past_due con grace_period_ends_at futuro. Sin fechas exigidas = no operable (salvo active sin cancel). paused/cancelled/expired = false.';

-- -----------------------------------------------------------------------------
-- ¿El tenant puede operar? (farmacia + comercial). Sin mirar membership.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_is_operable(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pharmacies ph
      WHERE ph.id = p_pharmacy_id
        -- suspended/archived: bloqueo operativo del tenant
        AND ph.status IS DISTINCT FROM 'suspended'
        AND ph.status IS DISTINCT FROM 'archived'
        -- pending_setup (y otros setup) OK si la suscripción es válida
        AND public.ff_pharmacy_subscription_is_valid(ph.id)
    );
$$;

COMMENT ON FUNCTION public.ff_pharmacy_is_operable(uuid) IS
  'True si la farmacia no está suspended/archived y su suscripción comercial es vigente (incl. trial y gracia). Independiente de memberships.';

-- -----------------------------------------------------------------------------
-- ¿El caller puede operar en esta farmacia? (plataforma O member+operable)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_can_operate_pharmacy(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
    OR (
      public.ff_is_active_member(p_pharmacy_id)
      AND public.ff_pharmacy_is_operable(p_pharmacy_id)
    );
$$;

COMMENT ON FUNCTION public.ff_can_operate_pharmacy(uuid) IS
  'Escritura operativa: SuperAdmin (pharmacies.write|subscriptions.manage) o member active + farmacia operable.';

REVOKE ALL ON FUNCTION public.ff_pharmacy_subscription_is_valid(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_pharmacy_is_operable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_can_operate_pharmacy(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_pharmacy_subscription_is_valid(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_is_operable(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_can_operate_pharmacy(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Políticas de escritura: camino tenant exige operabilidad.
-- SELECT sin cambio (soft-lock / lectura de estado).
-- -----------------------------------------------------------------------------

-- pharmacies UPDATE
DROP POLICY IF EXISTS pharmacies_update ON public.pharmacies;
CREATE POLICY pharmacies_update ON public.pharmacies
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(id, 'settings.update')
      AND public.ff_pharmacy_is_operable(id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(id, 'settings.update')
      AND public.ff_pharmacy_is_operable(id)
    )
  );

-- memberships INSERT/UPDATE (gestión de usuarios del tenant)
DROP POLICY IF EXISTS pharmacy_memberships_insert ON public.pharmacy_memberships;
CREATE POLICY pharmacy_memberships_insert ON public.pharmacy_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.users.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

DROP POLICY IF EXISTS pharmacy_memberships_update ON public.pharmacy_memberships;
CREATE POLICY pharmacy_memberships_update ON public.pharmacy_memberships
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.users.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.users.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- branding
DROP POLICY IF EXISTS pharmacy_branding_insert ON public.pharmacy_branding;
CREATE POLICY pharmacy_branding_insert ON public.pharmacy_branding
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'branding.update')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

DROP POLICY IF EXISTS pharmacy_branding_update ON public.pharmacy_branding;
CREATE POLICY pharmacy_branding_update ON public.pharmacy_branding
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'branding.update')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'branding.update')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- settings
DROP POLICY IF EXISTS pharmacy_settings_insert ON public.pharmacy_settings;
CREATE POLICY pharmacy_settings_insert ON public.pharmacy_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

DROP POLICY IF EXISTS pharmacy_settings_update ON public.pharmacy_settings;
CREATE POLICY pharmacy_settings_update ON public.pharmacy_settings
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- entrypoints
DROP POLICY IF EXISTS public_entrypoints_insert ON public.public_entrypoints;
CREATE POLICY public_entrypoints_insert ON public.public_entrypoints
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'entrypoints.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

DROP POLICY IF EXISTS public_entrypoints_update ON public.public_entrypoints;
CREATE POLICY public_entrypoints_update ON public.public_entrypoints
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'entrypoints.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'entrypoints.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- catálogo / productos
DROP POLICY IF EXISTS pharmacy_products_insert ON public.pharmacy_products;
CREATE POLICY pharmacy_products_insert ON public.pharmacy_products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

DROP POLICY IF EXISTS pharmacy_products_update ON public.pharmacy_products;
CREATE POLICY pharmacy_products_update ON public.pharmacy_products
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- DOWN (desarrollo): restaurar policies de 012/020 y DROP de helpers.
