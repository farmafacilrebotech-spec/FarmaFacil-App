-- =============================================================================
-- 014_profiles_select_via_definer_helper.sql
-- Evita que authenticated necesite SELECT directo sobre pharmacy_memberships
-- solo para evaluar la policy de profiles.
-- Semántica idéntica a profiles_select_own_or_platform original (012).
-- No modifica datos. No concede SELECT sobre pharmacy_memberships.
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
      -- propio perfil
      p_profile_id = (SELECT auth.uid())
      -- plataforma
      OR public.ff_has_platform_permission('platform.users.read')
      OR public.ff_has_platform_permission('platform.users.write')
      -- compañero de farmacia (mismas condiciones que la policy 012)
      OR EXISTS (
        SELECT 1
        FROM public.pharmacy_memberships viewer
        INNER JOIN public.pharmacy_memberships target
          ON target.pharmacy_id = viewer.pharmacy_id
        WHERE viewer.profile_id = (SELECT auth.uid())
          AND viewer.status = 'active'
          AND target.profile_id = p_profile_id
          AND target.status IN ('active', 'invited', 'suspended')
          AND public.ff_has_pharmacy_permission(
            viewer.pharmacy_id,
            'memberships.view'
          )
      )
    );
$$;

COMMENT ON FUNCTION public.ff_can_view_profile(uuid) IS
  'Visibilidad de profiles: propio, plataforma (users.read/write) o peer de farmacia con memberships.view. SECURITY DEFINER; identidad vía auth.uid().';

REVOKE ALL ON FUNCTION public.ff_can_view_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_can_view_profile(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS profiles_select_own_or_platform ON public.profiles;

CREATE POLICY profiles_select_own_or_platform ON public.profiles
  FOR SELECT TO authenticated
  USING (public.ff_can_view_profile(id));
