-- =============================================================================
-- 019_accept_pharmacy_invitation_v1_rpc.sql
-- Primer acceso: el usuario autenticado acepta SU propia invitación.
--
-- Por qué SECURITY DEFINER:
--   pharmacy_memberships_update (012) solo permite platform.users.write o
--   memberships.manage vía membership ACTIVE. Un usuario con status=invited
--   no puede actualizar su fila con UPDATE directo bajo RLS.
--   Esta RPC limita el cambio a invited → active sobre filas propias.
--
-- No permite:
--   cambiar pharmacy_id / profile_id / role_id;
--   activar memberships ajenas;
--   modificar roles ni platform_*;
--   elegir farmacia por parámetro del cliente.
--
-- NO APLICAR todavía desde este entorno: revisar y aplicar manualmente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_accept_pharmacy_invitation_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_count integer;
  v_membership_id uuid;
  v_pharmacy_id uuid;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'unauthenticated'
    );
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.pharmacy_memberships m
  WHERE m.profile_id = v_uid
    AND m.status = 'invited';

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'no_pending'
    );
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object(
      'status', 'multiple_pending',
      'count', v_count
    );
  END IF;

  UPDATE public.pharmacy_memberships m
  SET
    status = 'active',
    accepted_at = v_now,
    updated_by = v_uid,
    updated_at = v_now
  WHERE m.profile_id = v_uid
    AND m.status = 'invited'
  RETURNING m.id, m.pharmacy_id
  INTO v_membership_id, v_pharmacy_id;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'no_pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'membership_id', v_membership_id,
    'pharmacy_id', v_pharmacy_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_accept_pharmacy_invitation_v1() IS
  'Acepta la única membership invited del auth.uid(): invited→active + accepted_at. SECURITY DEFINER acotado; sin parámetros de farmacia.';

REVOKE ALL ON FUNCTION public.ff_accept_pharmacy_invitation_v1() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_accept_pharmacy_invitation_v1() TO authenticated;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_accept_pharmacy_invitation_v1() FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_accept_pharmacy_invitation_v1();
