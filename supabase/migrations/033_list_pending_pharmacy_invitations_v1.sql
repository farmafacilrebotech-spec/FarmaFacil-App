-- =============================================================================
-- 033_list_pending_pharmacy_invitations_v1.sql
-- Lista invitaciones pending (status=invited) del propio auth.uid().
--
-- Problema:
--   PostgREST con embeds pharmacies!inner / roles!inner falla para invited:
--   - ff_can_read_pharmacy solo contempla member active
--   - roles_select exige ff_has_any_active_membership()
--   → resolveAppAccess no ve pending → /access-denied
--
-- Solución mínima:
--   RPC SECURITY DEFINER que solo devuelve filas del caller (auth.uid())
--   con status=invited y los campos mínimos (nombre farmacia + rol de esa fila).
--   NO amplía SELECT general de pharmacies ni el catálogo roles.
--   NO concede acceso operativo (catálogo/pedidos) a invited.
--
-- Aceptación (sin cambio):
--   ff_accept_pharmacy_membership_v1 / ff_complete_pharmacy_first_access_v1
--   ya son DEFINER y activan invited→active sin embeds RLS.
--
-- NO APLICAR automáticamente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_list_pending_pharmacy_invitations_v1()
RETURNS TABLE (
  membership_id uuid,
  pharmacy_id uuid,
  pharmacy_name text,
  role_key text,
  role_name text,
  invited_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    m.id AS membership_id,
    m.pharmacy_id,
    p.name AS pharmacy_name,
    r.key AS role_key,
    r.name AS role_name,
    m.invited_at
  FROM public.pharmacy_memberships m
  INNER JOIN public.pharmacies p ON p.id = m.pharmacy_id
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.profile_id = (SELECT auth.uid())
    AND m.status = 'invited'
  ORDER BY m.invited_at DESC NULLS LAST, m.created_at DESC;
$$;

COMMENT ON FUNCTION public.ff_list_pending_pharmacy_invitations_v1() IS
  'Invitaciones pending del auth.uid(): membership invited + nombre farmacia + rol de esa fila. SECURITY DEFINER; no lista farmacias ajenas ni catálogo roles completo; no otorga acceso operativo.';

REVOKE ALL ON FUNCTION public.ff_list_pending_pharmacy_invitations_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_list_pending_pharmacy_invitations_v1()
  TO authenticated;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_list_pending_pharmacy_invitations_v1() FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_list_pending_pharmacy_invitations_v1();
