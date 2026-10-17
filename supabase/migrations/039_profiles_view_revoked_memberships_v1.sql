-- =============================================================================
-- 039_profiles_view_revoked_memberships_v1.sql
--
-- Problema:
--   Tras cancel_invitation o revoke, status = 'revoked'.
--   ff_can_view_profile (014) solo permite peers active|invited|suspended.
--   listPharmacyMembers hace embed de profiles → fila revoked sin perfil
--   visible para OWNER/ADMIN → se omite en el listado (historial invisible).
--
-- Cambio (mínimo, no destructivo):
--   Permitir SELECT de profiles de peers revoked SOLO si el viewer active
--   tiene memberships.manage en la misma farmacia (OWNER/ADMIN en seed).
--   Peers active|invited|suspended siguen exigiendo solo memberships.view
--   (PHARMACIST sin cambio de alcance previo).
--
-- Seguridad (checklist):
--   1) Aislamiento: JOIN viewer.pharmacy_id = target.pharmacy_id.
--   2) Sin farmacias cruzadas: no hay OR global ni bypass de pharmacy_id.
--   3) STAFF: sin memberships.view ni manage → sin peers (igual que 014).
--      PHARMACIST: memberships.view pero NO manage → ve active/invited/
--      suspended; NO obtiene lectura nueva de perfiles revoked.
--   4) Viewer debe ser status=active; revoked del target no concede
--      ff_is_active_member ni ff_has_pharmacy_permission (011).
--   5) SECURITY DEFINER lee memberships sin RLS; no consulta profiles
--      → sin recursión. No toca policies INSERT/UPDATE.
--   6) Ramas propio + platform.users.read/write idénticas a 014.
--   7) CREATE OR REPLACE function only; compatible 034–038; no DML.
--
-- NO APLICAR automáticamente desde el agente.
-- Depende de: 014 (ff_can_view_profile), 011 (ff_has_pharmacy_permission).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_can_view_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_profile_id IS NOT NULL
    AND (
      -- propio perfil (igual 014)
      p_profile_id = (SELECT auth.uid())
      -- plataforma (igual 014)
      OR public.ff_has_platform_permission('platform.users.read')
      OR public.ff_has_platform_permission('platform.users.write')
      -- peer misma farmacia
      OR EXISTS (
        SELECT 1
        FROM public.pharmacy_memberships viewer
        INNER JOIN public.pharmacy_memberships target
          ON target.pharmacy_id = viewer.pharmacy_id
        WHERE viewer.profile_id = (SELECT auth.uid())
          AND viewer.status = 'active'
          AND target.profile_id = p_profile_id
          AND (
            -- Alcance previo (014): ver compañeros operativos / invitados
            (
              target.status IN ('active', 'invited', 'suspended')
              AND public.ff_has_pharmacy_permission(
                viewer.pharmacy_id,
                'memberships.view'
              )
            )
            -- Nuevo (039): historial cancelado / baja — solo gestores
            OR (
              target.status = 'revoked'
              AND public.ff_has_pharmacy_permission(
                viewer.pharmacy_id,
                'memberships.manage'
              )
            )
          )
      )
    );
$$;

COMMENT ON FUNCTION public.ff_can_view_profile(uuid) IS
  'Visibilidad de profiles: propio; plataforma users.read/write; peers active|invited|suspended con memberships.view; peers revoked con memberships.manage. Misma farmacia; viewer active. SECURITY DEFINER; sin recursión a profiles.';

REVOKE ALL ON FUNCTION public.ff_can_view_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_can_view_profile(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Comprobaciones de catálogo (solo si el seed ya pobló roles/permisos).
-- En db reset: migrations → seed; aquí se omite. En prod/staging con seed
-- previo: falla el migrate si el catálogo concede manage/view de forma
-- incompatible con esta política.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_catalog_ready boolean;
  v_pharmacist_has_manage boolean;
  v_staff_has_view boolean;
  v_staff_has_manage boolean;
  v_owner_has_manage boolean;
  v_admin_has_manage boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM public.roles WHERE key = 'PHARMACY_OWNER')
    AND EXISTS (SELECT 1 FROM public.roles WHERE key = 'PHARMACY_ADMIN')
    AND EXISTS (SELECT 1 FROM public.roles WHERE key = 'PHARMACIST')
    AND EXISTS (SELECT 1 FROM public.roles WHERE key = 'STAFF')
    AND EXISTS (SELECT 1 FROM public.permissions WHERE key = 'memberships.view')
    AND EXISTS (SELECT 1 FROM public.permissions WHERE key = 'memberships.manage')
  INTO v_catalog_ready;

  IF NOT v_catalog_ready THEN
    RAISE NOTICE
      '039: catálogo roles/permisos aún no sembrado; se omiten checks de seguridad de seed.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    INNER JOIN public.role_permissions rp ON rp.role_id = r.id
    INNER JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.key = 'PHARMACIST' AND p.key = 'memberships.manage'
  ) INTO v_pharmacist_has_manage;

  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    INNER JOIN public.role_permissions rp ON rp.role_id = r.id
    INNER JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.key = 'STAFF' AND p.key = 'memberships.view'
  ) INTO v_staff_has_view;

  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    INNER JOIN public.role_permissions rp ON rp.role_id = r.id
    INNER JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.key = 'STAFF' AND p.key = 'memberships.manage'
  ) INTO v_staff_has_manage;

  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    INNER JOIN public.role_permissions rp ON rp.role_id = r.id
    INNER JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.key = 'PHARMACY_OWNER' AND p.key = 'memberships.manage'
  ) INTO v_owner_has_manage;

  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    INNER JOIN public.role_permissions rp ON rp.role_id = r.id
    INNER JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.key = 'PHARMACY_ADMIN' AND p.key = 'memberships.manage'
  ) INTO v_admin_has_manage;

  IF v_pharmacist_has_manage THEN
    RAISE EXCEPTION
      '039 security check: PHARMACIST no debe tener memberships.manage (vería perfiles revoked).';
  END IF;

  IF v_staff_has_view OR v_staff_has_manage THEN
    RAISE EXCEPTION
      '039 security check: STAFF no debe tener memberships.view ni memberships.manage.';
  END IF;

  IF NOT v_owner_has_manage OR NOT v_admin_has_manage THEN
    RAISE EXCEPTION
      '039 security check: OWNER y ADMIN deben tener memberships.manage para ver historial revoked.';
  END IF;
END;
$$;

-- DOWN (desarrollo): restaurar cuerpo de 014 (sin rama revoked / manage).
