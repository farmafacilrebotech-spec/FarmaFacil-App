-- =============================================================================
-- 018_pharmacy_membership_access_grants.sql
-- GRANT mínimos para resolución de acceso tenant (memberships + roles).
--
-- Alcance:
--   - SELECT pharmacy_memberships: el usuario lee las filas que RLS permite
--     (propias, plataforma users.read/write, o compañero con memberships.view).
--   - INSERT/UPDATE pharmacy_memberships: SuperAdmin (platform.users.write)
--     o miembro con memberships.manage — policies ya existentes en 012.
--   - SELECT roles: resolver key/name del rol de la membership (embed FK)
--     y listar roles al asignar (fase posterior).
--
-- Fuera de alcance (sin GRANT aquí):
--   - permissions / role_permissions (permisos vía helpers ff_* DEFINER)
--   - DELETE / ALL
--   - privilegios a anon
--
-- No toca RLS ni policies. Autorización sigue en RBAC + helpers 011/012.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_memberships TO authenticated;

GRANT SELECT ON TABLE public.roles TO authenticated;
