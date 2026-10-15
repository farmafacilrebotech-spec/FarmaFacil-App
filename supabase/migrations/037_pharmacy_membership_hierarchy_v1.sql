-- =============================================================================
-- 037_pharmacy_membership_hierarchy_v1.sql
-- Jerarquía de gestión de membresías + anti auto-acción en RPC y trigger.
--
-- Reglas (camino tenant; platform.users.write bypasea jerarquía, no el self-block):
--   - OWNER: gestiona ADMIN, PHARMACIST y STAFF. No crea ni gestiona otros OWNER
--     (titulares = PLATFORM_SUPERADMIN / platform.users.write).
--   - ADMIN: solo PHARMACIST y STAFF (no OWNER ni ADMIN).
--   - Nadie puede suspender / revocar / cancelar su propia membership.
--   - Último OWNER activo: protegido en esta RPC (y edición app).
--   - Aceptación propia invited→active: permitida en el trigger (sin manage).
--
-- Depende de: 031 (cuerpo operable + reinvite).
-- NO APLICAR automáticamente en producción.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: rol de farmacia del actor (active) en una farmacia
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_actor_pharmacy_role_key(p_pharmacy_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT r.key
  FROM public.pharmacy_memberships m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.pharmacy_id = p_pharmacy_id
    AND m.profile_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.ff_actor_pharmacy_role_key(uuid) IS
  'Rol de farmacia active del caller en p_pharmacy_id, o NULL.';

REVOKE ALL ON FUNCTION public.ff_actor_pharmacy_role_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_actor_pharmacy_role_key(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Helper: ¿puede el actor tenant gestionar el rol objetivo?
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_can_manage_pharmacy_role(
  p_actor_role_key text,
  p_target_role_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_actor_role_key = 'PHARMACY_OWNER' THEN
        -- Flujo ordinario: no gestiona otros titulares (OWNER).
        p_target_role_key IN ('PHARMACY_ADMIN', 'PHARMACIST', 'STAFF')
      WHEN p_actor_role_key = 'PHARMACY_ADMIN' THEN
        p_target_role_key IN ('PHARMACIST', 'STAFF')
      ELSE false
    END;
$$;

COMMENT ON FUNCTION public.ff_can_manage_pharmacy_role(text, text) IS
  'Jerarquía: OWNER→ADMIN/PHARMACIST/STAFF; ADMIN→PHARMACIST/STAFF. Titulares solo plataforma.';

REVOKE ALL ON FUNCTION public.ff_can_manage_pharmacy_role(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_can_manage_pharmacy_role(text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Trigger: INSERT/UPDATE memberships (rol + anti-escalada)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_memberships_enforce_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_role text;
  v_new_role text;
  v_old_role text;
BEGIN
  -- service_role / sin JWT (jobs): no restringir aquí.
  IF v_uid IS NULL OR public.ff_is_service_role() THEN
    RETURN NEW;
  END IF;

  -- SuperAdmin con platform.users.write: bypasea jerarquía.
  IF public.ff_has_platform_permission('platform.users.write') THEN
    -- Self-block en UPDATE de status destructivo.
    IF TG_OP = 'UPDATE'
       AND NEW.profile_id = v_uid
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('suspended', 'revoked')
       AND OLD.status IN ('active', 'invited', 'suspended') THEN
      RAISE EXCEPTION 'membership_self_action'
        USING ERRCODE = '42501',
              MESSAGE = 'No puedes suspender, revocar ni cancelar tu propio acceso.';
    END IF;
    RETURN NEW;
  END IF;

  -- Aceptación de invitación propia (RPC 019/024): invited → active.
  -- El invitee aún no es active → no tiene memberships.manage; no aplicar jerarquía.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'invited'
     AND NEW.status = 'active'
     AND NEW.profile_id = v_uid
     AND NEW.role_id IS NOT DISTINCT FROM OLD.role_id
     AND NEW.pharmacy_id IS NOT DISTINCT FROM OLD.pharmacy_id THEN
    RETURN NEW;
  END IF;

  v_actor_role := public.ff_actor_pharmacy_role_key(NEW.pharmacy_id);
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'membership_hierarchy_forbidden'
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso para gestionar usuarios de esta farmacia.';
  END IF;

  SELECT r.key INTO v_new_role
  FROM public.roles r
  WHERE r.id = NEW.role_id;

  IF v_new_role IS NULL THEN
    RAISE EXCEPTION 'membership_invalid_role'
      USING ERRCODE = '22023',
            MESSAGE = 'Rol de membresía no válido.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.ff_can_manage_pharmacy_role(v_actor_role, v_new_role) THEN
      RAISE EXCEPTION 'membership_hierarchy_forbidden'
        USING ERRCODE = '42501',
              MESSAGE = 'No puedes asignar ese rol con tu nivel de acceso.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  SELECT r.key INTO v_old_role
  FROM public.roles r
  WHERE r.id = OLD.role_id;

  -- No gestionar filas de OWNER/ADMIN si eres solo ADMIN.
  IF NOT public.ff_can_manage_pharmacy_role(v_actor_role, COALESCE(v_old_role, v_new_role)) THEN
    RAISE EXCEPTION 'membership_hierarchy_forbidden'
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso para gestionar usuarios con este rol en la farmacia.';
  END IF;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     AND NOT public.ff_can_manage_pharmacy_role(v_actor_role, v_new_role) THEN
    RAISE EXCEPTION 'membership_hierarchy_forbidden'
      USING ERRCODE = '42501',
            MESSAGE = 'No puedes asignar ese rol con tu nivel de acceso.';
  END IF;

  IF NEW.profile_id = v_uid
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('suspended', 'revoked') THEN
    RAISE EXCEPTION 'membership_self_action'
      USING ERRCODE = '42501',
            MESSAGE = 'No puedes suspender, revocar ni cancelar tu propio acceso.';
  END IF;

  -- pharmacy_id inmutable en membership (aislamiento).
  IF NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id THEN
    RAISE EXCEPTION 'membership_pharmacy_immutable'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'No se puede reasignar una membresía a otra farmacia.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_memberships_enforce_hierarchy() IS
  'Trigger: jerarquía OWNER/ADMIN + self-block + pharmacy_id inmutable.';

REVOKE ALL ON FUNCTION public.ff_pharmacy_memberships_enforce_hierarchy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_memberships_enforce_hierarchy()
  TO postgres, service_role;

DROP TRIGGER IF EXISTS pharmacy_memberships_enforce_hierarchy
  ON public.pharmacy_memberships;

CREATE TRIGGER pharmacy_memberships_enforce_hierarchy
  BEFORE INSERT OR UPDATE ON public.pharmacy_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_pharmacy_memberships_enforce_hierarchy();

-- -----------------------------------------------------------------------------
-- RPC transition: jerarquía + self-block (sobre 031)
-- -----------------------------------------------------------------------------
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
  v_profile_id uuid;
  v_owner_count integer;
  v_is_platform boolean;
  v_actor_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = '28000',
            MESSAGE = 'Debes iniciar sesión.';
  END IF;

  IF p_pharmacy_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = '22023',
            MESSAGE = 'Farmacia o membresía no válidas.';
  END IF;

  IF v_action NOT IN (
    'suspend',
    'reactivate',
    'revoke',
    'cancel_invitation',
    'reinvite'
  ) THEN
    RAISE EXCEPTION
      USING ERRCODE = '22023',
            MESSAGE = 'Acción de membresía no reconocida.';
  END IF;

  v_is_platform := public.ff_has_platform_permission('platform.users.write');

  IF NOT (
    v_is_platform
    OR public.ff_has_pharmacy_permission(p_pharmacy_id, 'memberships.manage')
  ) THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso para gestionar usuarios de esta farmacia.';
  END IF;

  IF NOT v_is_platform
     AND NOT public.ff_pharmacy_is_operable(p_pharmacy_id) THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'No se pueden gestionar usuarios mientras la farmacia no tiene acceso comercial vigente.';
  END IF;

  SELECT m.status, r.key, m.profile_id
    INTO v_status, v_role_key, v_profile_id
  FROM public.pharmacy_memberships m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.id = p_membership_id
    AND m.pharmacy_id = p_pharmacy_id
  FOR UPDATE OF m;

  IF v_status IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0002',
            MESSAGE = 'La membresía no pertenece a esta farmacia o no existe.';
  END IF;

  -- Anti auto-acción (plataforma y tenant).
  IF v_action IN ('suspend', 'revoke', 'cancel_invitation')
     AND v_profile_id = v_uid THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'No puedes suspender, revocar ni cancelar tu propio acceso.';
  END IF;

  -- Jerarquía tenant.
  IF NOT v_is_platform THEN
    v_actor_role := public.ff_actor_pharmacy_role_key(p_pharmacy_id);
    IF v_actor_role IS NULL
       OR NOT public.ff_can_manage_pharmacy_role(v_actor_role, v_role_key) THEN
      RAISE EXCEPTION
        USING ERRCODE = '42501',
              MESSAGE = 'No tienes permiso para gestionar usuarios con este rol en la farmacia.';
    END IF;
  END IF;

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
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'No se puede suspender ni revocar al último propietario activo. Asigna antes otro propietario (PHARMACY_OWNER) a esta farmacia.';
    END IF;
  END IF;

  IF v_action = 'suspend' THEN
    IF v_status <> 'active' THEN
      RAISE EXCEPTION
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
      RAISE EXCEPTION
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
      RAISE EXCEPTION
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
      RAISE EXCEPTION
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

  ELSIF v_action = 'reinvite' THEN
    IF v_status <> 'revoked' THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede volver a invitar a un usuario con acceso revocado.';
    END IF;

    UPDATE public.pharmacy_memberships m
    SET
      status = 'invited',
      invited_at = v_now,
      revoked_at = NULL,
      suspended_at = NULL,
      updated_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_membership_id
      AND m.pharmacy_id = p_pharmacy_id
      AND m.status = 'revoked';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION
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
  'Transiciones membership con jerarquía OWNER/ADMIN, self-block y last OWNER. Tenant exige operable.';

REVOKE ALL ON FUNCTION public.ff_transition_pharmacy_membership_v1(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_transition_pharmacy_membership_v1(uuid, uuid, text)
  TO authenticated;

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS pharmacy_memberships_enforce_hierarchy ON public.pharmacy_memberships;
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_memberships_enforce_hierarchy();
-- DROP FUNCTION IF EXISTS public.ff_can_manage_pharmacy_role(text, text);
-- DROP FUNCTION IF EXISTS public.ff_actor_pharmacy_role_key(uuid);
-- Redeploy cuerpo 031 de ff_transition_pharmacy_membership_v1.
