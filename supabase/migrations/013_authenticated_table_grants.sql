-- =============================================================================
-- 013_authenticated_table_grants.sql
-- Privilegio SQL mínimo para que RLS pueda aplicarse.
-- No desactiva RLS. No añade policies. No toca datos.
-- =============================================================================

-- Lectura del propio perfil (y filas permitidas por RLS existente).
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Resolución PLATFORM_SUPERADMIN vía:
-- platform_user_roles → platform_roles (key)
GRANT SELECT ON TABLE public.platform_user_roles TO authenticated;
GRANT SELECT ON TABLE public.platform_roles TO authenticated;
