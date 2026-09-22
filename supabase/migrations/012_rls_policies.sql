-- =============================================================================
-- 012_rls_policies.sql
-- RLS en todas las tablas del kernel + policies.
-- Ninguna policy USING (true) / WITH CHECK (true) para authenticated.
-- service_role bypassa RLS (solo servidor).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_entrypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Catálogos plataforma / farmacia / producto (lectura restringida)
-- -----------------------------------------------------------------------------

CREATE POLICY platform_roles_select ON public.platform_roles
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY platform_permissions_select ON public.platform_permissions
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY platform_role_permissions_select ON public.platform_role_permissions
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY plans_select ON public.plans
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY plans_write ON public.plans
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.plans.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.plans.write'));

CREATE POLICY modules_select ON public.modules
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY modules_write ON public.modules
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.plans.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.plans.write'));

CREATE POLICY plan_modules_select ON public.plan_modules
  FOR SELECT TO authenticated
  USING (public.ff_is_platform_user() OR public.ff_has_any_active_membership());

CREATE POLICY plan_modules_write ON public.plan_modules
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.plans.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.plans.write'));

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

CREATE POLICY profiles_select_own_or_platform ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.ff_has_platform_permission('platform.users.read')
    OR public.ff_has_platform_permission('platform.users.write')
    OR EXISTS (
      SELECT 1
      FROM public.pharmacy_memberships viewer
      INNER JOIN public.pharmacy_memberships target
        ON target.pharmacy_id = viewer.pharmacy_id
      WHERE viewer.profile_id = (SELECT auth.uid())
        AND viewer.status = 'active'
        AND target.profile_id = profiles.id
        AND target.status IN ('active', 'invited', 'suspended')
        AND public.ff_has_pharmacy_permission(viewer.pharmacy_id, 'memberships.view')
    )
  );

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_platform ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.users.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.users.write'));

-- -----------------------------------------------------------------------------
-- platform_user_roles
-- -----------------------------------------------------------------------------

CREATE POLICY platform_user_roles_select ON public.platform_user_roles
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR public.ff_has_platform_permission('platform.admins.manage')
    OR public.ff_has_platform_permission('platform.users.read')
  );

CREATE POLICY platform_user_roles_insert ON public.platform_user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.admins.manage'));

CREATE POLICY platform_user_roles_delete ON public.platform_user_roles
  FOR DELETE TO authenticated
  USING (public.ff_has_platform_permission('platform.admins.manage'));

-- -----------------------------------------------------------------------------
-- pharmacies
-- -----------------------------------------------------------------------------

CREATE POLICY pharmacies_select ON public.pharmacies
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy(id));

CREATE POLICY pharmacies_insert ON public.pharmacies
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.pharmacies.write'));

CREATE POLICY pharmacies_update ON public.pharmacies
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(id, 'settings.update')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(id, 'settings.update')
  );

-- Sin DELETE

-- -----------------------------------------------------------------------------
-- pharmacy_memberships / entitlements
-- -----------------------------------------------------------------------------

CREATE POLICY pharmacy_memberships_select ON public.pharmacy_memberships
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR public.ff_has_platform_permission('platform.users.read')
    OR public.ff_has_platform_permission('platform.users.write')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.view')
    )
  );

CREATE POLICY pharmacy_memberships_insert ON public.pharmacy_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.users.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.manage')
  );

CREATE POLICY pharmacy_memberships_update ON public.pharmacy_memberships
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.users.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.manage')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.users.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'memberships.manage')
  );

CREATE POLICY pharmacy_entitlements_select ON public.pharmacy_entitlements
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.entitlements.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_is_active_member(pharmacy_id)
  );

CREATE POLICY pharmacy_entitlements_insert ON public.pharmacy_entitlements
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.entitlements.manage'));

CREATE POLICY pharmacy_entitlements_update ON public.pharmacy_entitlements
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.entitlements.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.entitlements.manage'));

-- -----------------------------------------------------------------------------
-- subscriptions (provider-agnostic)
-- -----------------------------------------------------------------------------

CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.read')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
    OR (
      public.ff_is_active_member(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'pharmacy.view')
    )
  );

CREATE POLICY subscriptions_insert ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.subscriptions.manage'));

CREATE POLICY subscriptions_update ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.subscriptions.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.subscriptions.manage'));

-- Sin DELETE: cancel/expire por status

-- -----------------------------------------------------------------------------
-- branding / settings / entrypoints
-- -----------------------------------------------------------------------------

CREATE POLICY pharmacy_branding_select ON public.pharmacy_branding
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy(pharmacy_id));

CREATE POLICY pharmacy_branding_insert ON public.pharmacy_branding
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'branding.update')
  );

CREATE POLICY pharmacy_branding_update ON public.pharmacy_branding
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'branding.update')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'branding.update')
  );

CREATE POLICY pharmacy_settings_select ON public.pharmacy_settings
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy(pharmacy_id));

CREATE POLICY pharmacy_settings_insert ON public.pharmacy_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
  );

CREATE POLICY pharmacy_settings_update ON public.pharmacy_settings
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
  );

-- Entrypoints: sin policy anon. Resolución pública = Route Handler + service_role.
-- access_count/last_access_at protegidos por trigger aunque haya UPDATE de negocio.
CREATE POLICY public_entrypoints_select ON public.public_entrypoints
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy(pharmacy_id));

CREATE POLICY public_entrypoints_insert ON public.public_entrypoints
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'entrypoints.manage')
  );

CREATE POLICY public_entrypoints_update ON public.public_entrypoints
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'entrypoints.manage')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'entrypoints.manage')
  );

-- -----------------------------------------------------------------------------
-- audit_logs / activity_events
-- -----------------------------------------------------------------------------

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.audit.read')
    OR (
      pharmacy_id IS NOT NULL
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'audit.view')
    )
  );

CREATE POLICY activity_events_select ON public.activity_events
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR (
      pharmacy_id IS NOT NULL
      AND public.ff_is_active_member(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'activity.view')
    )
  );

CREATE POLICY activity_events_insert ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      pharmacy_id IS NOT NULL
      AND public.ff_is_active_member(pharmacy_id)
    )
  );

-- DOWN: drop policies en orden inverso + DISABLE RLS si se revierte por completo
