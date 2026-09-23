-- =============================================================================
-- 023_pharmacy_membership_lifecycle_v1.sql
-- Transiciones seguras de pharmacy_memberships (suspender / reactivar / revocar /
-- cancelar invitación) en una sola transacción, con protección del último
-- PHARMACY_OWNER activo.
--
-- Por qué SECURITY DEFINER:
--   - Garantiza atomicidad del chequeo "último propietario" + UPDATE.
--   - Autoriza vía platform.users.write O memberships.manage (preparado para
--     panel de farmacia; SuperAdmin usa platform.users.write).
--   - Valida que membership_id pertenece a pharmacy_id (nunca confiar solo en
--     el cliente).
--
-- NO modifica auth.users. NO hard-delete. NO toca memberships de otras farmacias.
-- NO aplica first-access / legal / catálogo.
--
-- NO APLICAR todavía: revisar y aplicar manualmente tras aprobación.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_transition_pharmacy_membership_v1(
  p_pharmacy_id uuid,
  p_membership_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_status text;
  v_role_key text;
  v_owner_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated'
      USING ERRCODE = '28000',
            MESSAGE = 'Debes iniciar sesión.';
  END IF;

  IF p_pharmacy_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input'
      USING ERRCODE = '22023',
            MESSAGE = 'Farmacia o membresía no válidas.';
  END IF;

  IF v_action NOT IN ('suspend', 'reactivate', 'revoke', 'cancel_invitation') THEN
    RAISE EXCEPTION 'invalid_action'
      USING ERRCODE = '22023',
            MESSAGE = 'Acción de membresía no reconocida.';
  END IF;

  -- Autorización: plataforma o permiso de farmacia (memberships.manage).
  IF NOT (
    public.ff_has_platform_permission('platform.users.write')
    OR public.ff_has_pharmacy_permission(p_pharmacy_id, 'memberships.manage')
  ) THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso para gestionar usuarios de esta farmacia.';
  END IF;

  -- Bloqueo de fila + pertenencia a la farmacia gestionada.
  SELECT m.status, r.key
    INTO v_status, v_role_key
  FROM public.pharmacy_memberships m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.id = p_membership_id
    AND m.pharmacy_id = p_pharmacy_id
  FOR UPDATE OF m;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'not_found'
      USING ERRCODE = 'P0002',
            MESSAGE = 'La membresía no pertenece a esta farmacia o no existe.';
  END IF;

  -- Protección: no dejar la farmacia sin PHARMACY_OWNER activo.
  IF v_action IN ('suspend', 'revoke')
     AND v_status = 'active'
     AND v_role_key = 'PHARMACY_OWNER' THEN
    SELECT count(*)::integer
      INTO v_owner_count
    FROM public.pharmacy_memberships m
    INNER JOIN public.roles r ON r.id = m.role_id
    WHERE m.pharmacy_id = p_pharmacy_id
      AND m.status = 'active'
      AND r.key = 'PHARMACY_OWNER';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'last_active_owner'
        USING ERRCODE = 'P0001',
              MESSAGE = 'No se puede suspender ni revocar al último propietario activo. Asigna antes otro propietario (PHARMACY_OWNER) a esta farmacia.';
    END IF;
  END IF;

  IF v_action = 'suspend' THEN
    IF v_status <> 'active' THEN
      RAISE EXCEPTION 'invalid_state'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede suspender un usuario con acceso activo.';
    END IF;

    UPDATE public.pharmacy_memberships m
    SET
      status = 'suspended',
      suspended_at = v_now,
      updated_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_membership_id
      AND m.pharmacy_id = p_pharmacy_id
      AND m.status = 'active';

  ELSIF v_action = 'reactivate' THEN
    IF v_status <> 'suspended' THEN
      RAISE EXCEPTION 'invalid_state'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede reactivar un usuario suspendido.';
    END IF;

    UPDATE public.pharmacy_memberships m
    SET
      status = 'active',
      suspended_at = NULL,
      updated_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_membership_id
      AND m.pharmacy_id = p_pharmacy_id
      AND m.status = 'suspended';

  ELSIF v_action = 'revoke' THEN
    IF v_status NOT IN ('active', 'suspended') THEN
      RAISE EXCEPTION 'invalid_state'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede revocar un acceso activo o suspendido.';
    END IF;

    UPDATE public.pharmacy_memberships m
    SET
      status = 'revoked',
      revoked_at = v_now,
      updated_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_membership_id
      AND m.pharmacy_id = p_pharmacy_id
      AND m.status IN ('active', 'suspended');

  ELSIF v_action = 'cancel_invitation' THEN
    IF v_status <> 'invited' THEN
      RAISE EXCEPTION 'invalid_state'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede cancelar una invitación pendiente.';
    END IF;

    UPDATE public.pharmacy_memberships m
    SET
      status = 'revoked',
      revoked_at = v_now,
      updated_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_membership_id
      AND m.pharmacy_id = p_pharmacy_id
      AND m.status = 'invited';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_state'
      USING ERRCODE = 'P0001',
            MESSAGE = 'El estado de la membresía ha cambiado. Recarga e inténtalo de nuevo.';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'membership_id', p_membership_id,
    'pharmacy_id', p_pharmacy_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_transition_pharmacy_membership_v1(uuid, uuid, text) IS
  'Transiciones membership: suspend|reactivate|revoke|cancel_invitation. Valida pharmacy_id+membership_id, autoriza platform.users.write o memberships.manage, bloquea último PHARMACY_OWNER activo. Sin hard-delete ni auth.users.';

REVOKE ALL ON FUNCTION public.ff_transition_pharmacy_membership_v1(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_transition_pharmacy_membership_v1(uuid, uuid, text) TO authenticated;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_transition_pharmacy_membership_v1(uuid, uuid, text) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_transition_pharmacy_membership_v1(uuid, uuid, text);
