-- =============================================================================
-- 024_accept_pharmacy_membership_v1.sql
-- Aceptación de UNA membership invited concreta por el propio usuario.
--
-- Por qué SECURITY DEFINER:
--   pharmacy_memberships_update (012) exige platform.users.write o
--   memberships.manage vía membership ACTIVE. Un usuario invited no puede
--   activar su fila con UPDATE directo bajo RLS.
--
-- Seguridad:
--   - Solo auth.uid(); el membership_id debe pertenecer a ese profile.
--   - Solo status invited → active.
--   - No toca password, legal, Auth ni otras farmacias.
--   - No exige "exactamente una" invited (soporta varias pendientes).
--
-- NO APLICAR todavía: revisar y aplicar manualmente tras aprobación.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_accept_pharmacy_membership_v1(
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_membership_id uuid;
  v_pharmacy_id uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_membership_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  SELECT m.id, m.pharmacy_id, m.status
    INTO v_membership_id, v_pharmacy_id, v_status
  FROM public.pharmacy_memberships m
  WHERE m.id = p_membership_id
    AND m.profile_id = v_uid
  FOR UPDATE OF m;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_status <> 'invited' THEN
    RETURN jsonb_build_object(
      'status', 'invalid_state',
      'current_status', v_status
    );
  END IF;

  UPDATE public.pharmacy_memberships m
  SET
    status = 'active',
    accepted_at = v_now,
    updated_by = v_uid,
    updated_at = v_now
  WHERE m.id = v_membership_id
    AND m.profile_id = v_uid
    AND m.status = 'invited';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_state');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'membership_id', v_membership_id,
    'pharmacy_id', v_pharmacy_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid) IS
  'Acepta una membership invited concreta del auth.uid(): invited→active + accepted_at. Sin parámetros de farmacia ajenos; sin password/legal.';

REVOKE ALL ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid) TO authenticated;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_accept_pharmacy_membership_v1(uuid);
