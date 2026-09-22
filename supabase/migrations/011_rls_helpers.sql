-- =============================================================================
-- 011_rls_helpers.sql
-- Helpers SECURITY DEFINER para RLS, auditoría y contadores de entrypoints.
-- search_path fijo; nombres cualificados; EXECUTE revocado a PUBLIC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Autorización (STABLE, SECURITY DEFINER)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ff_is_platform_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_user_roles pur
    WHERE pur.profile_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.ff_has_platform_permission(p_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_user_roles pur
    INNER JOIN public.platform_role_permissions prp
      ON prp.platform_role_id = pur.platform_role_id
    INNER JOIN public.platform_permissions pp
      ON pp.id = prp.platform_permission_id
    WHERE pur.profile_id = (SELECT auth.uid())
      AND pp.key = p_permission_key
  );
$$;

CREATE OR REPLACE FUNCTION public.ff_is_active_member(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pharmacy_memberships m
      WHERE m.pharmacy_id = p_pharmacy_id
        AND m.profile_id = (SELECT auth.uid())
        AND m.status = 'active'
    );
$$;

COMMENT ON FUNCTION public.ff_is_active_member(uuid) IS
  'True solo con membresía active. invited/suspended/revoked = false. No usa last_pharmacy_id.';

CREATE OR REPLACE FUNCTION public.ff_has_any_active_membership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pharmacy_memberships m
    WHERE m.profile_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.ff_has_pharmacy_permission(
  p_pharmacy_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pharmacy_memberships m
      INNER JOIN public.role_permissions rp ON rp.role_id = m.role_id
      INNER JOIN public.permissions p ON p.id = rp.permission_id
      WHERE m.pharmacy_id = p_pharmacy_id
        AND m.profile_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND p.key = p_permission_key
    );
$$;

CREATE OR REPLACE FUNCTION public.ff_pharmacy_has_module(
  p_pharmacy_id uuid,
  p_module_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_pharmacy_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pharmacy_entitlements e
      INNER JOIN public.modules mod ON mod.id = e.module_id
      WHERE e.pharmacy_id = p_pharmacy_id
        AND mod.key = p_module_key
        AND e.status IN ('active', 'trial')
        AND mod.is_active = true
        AND (e.starts_at IS NULL OR e.starts_at <= pg_catalog.now())
        AND (e.ends_at IS NULL OR e.ends_at > pg_catalog.now())
    );
$$;

CREATE OR REPLACE FUNCTION public.ff_can_read_pharmacy(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_is_active_member(p_pharmacy_id);
$$;

CREATE OR REPLACE FUNCTION public.ff_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce((SELECT auth.role()), '') = 'service_role';
$$;

-- -----------------------------------------------------------------------------
-- Auditoría y actividad controladas
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ff_write_audit_log(
  p_action text,
  p_pharmacy_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_id uuid;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'ff_write_audit_log: action requerida';
  END IF;
  IF jsonb_typeof(v_meta) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ff_write_audit_log: metadata debe ser objeto JSON';
  END IF;

  IF public.ff_is_service_role() THEN
    NULL;
  ELSIF v_actor IS NULL THEN
    RAISE EXCEPTION 'ff_write_audit_log: no autenticado';
  ELSIF p_action = 'support.enter_pharmacy_context' THEN
    IF p_pharmacy_id IS NULL THEN
      RAISE EXCEPTION 'ff_write_audit_log: pharmacy_id requerido para enter context';
    END IF;
    IF NOT public.ff_has_platform_permission('platform.support.enter_pharmacy_context') THEN
      RAISE EXCEPTION 'ff_write_audit_log: permiso platform.support.enter_pharmacy_context requerido';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.pharmacies ph WHERE ph.id = p_pharmacy_id) THEN
      RAISE EXCEPTION 'ff_write_audit_log: farmacia inexistente';
    END IF;
  ELSIF p_pharmacy_id IS NOT NULL THEN
    IF NOT (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_platform_permission('platform.audit.read')
      OR public.ff_is_active_member(p_pharmacy_id)
    ) THEN
      RAISE EXCEPTION 'ff_write_audit_log: sin autorización para pharmacy_id';
    END IF;
  ELSE
    IF NOT (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_platform_permission('platform.admins.manage')
      OR public.ff_has_platform_permission('platform.audit.read')
    ) THEN
      RAISE EXCEPTION 'ff_write_audit_log: sin autorización de plataforma';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, ip, user_agent, metadata
  ) VALUES (
    v_actor, p_pharmacy_id, trim(p_action), p_entity_type, p_entity_id, p_ip, p_user_agent, v_meta
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ff_record_activity_event(
  p_pharmacy_id uuid,
  p_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_id uuid;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
BEGIN
  IF p_type IS NULL OR length(trim(p_type)) = 0 THEN
    RAISE EXCEPTION 'ff_record_activity_event: type requerido';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'ff_record_activity_event: title requerido';
  END IF;
  IF jsonb_typeof(v_meta) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ff_record_activity_event: metadata debe ser objeto JSON';
  END IF;

  IF public.ff_is_service_role() THEN
    NULL;
  ELSIF v_actor IS NULL THEN
    RAISE EXCEPTION 'ff_record_activity_event: no autenticado';
  ELSIF p_pharmacy_id IS NOT NULL THEN
    IF NOT (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_is_active_member(p_pharmacy_id)
    ) THEN
      RAISE EXCEPTION 'ff_record_activity_event: sin autorización para pharmacy_id';
    END IF;
  ELSE
    IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
      RAISE EXCEPTION 'ff_record_activity_event: evento global requiere permiso de plataforma';
    END IF;
  END IF;

  INSERT INTO public.activity_events (
    pharmacy_id, actor_profile_id, type, title, description, metadata
  ) VALUES (
    p_pharmacy_id, v_actor, trim(p_type), trim(p_title), p_description, v_meta
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Preferencia last_pharmacy_id: nunca autoriza
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ff_validate_last_pharmacy_preference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.last_pharmacy_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.ff_has_platform_permission('platform.pharmacies.read')
     OR public.ff_has_platform_permission('platform.support.enter_pharmacy_context') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pharmacy_memberships m
    WHERE m.pharmacy_id = NEW.last_pharmacy_id
      AND m.profile_id = NEW.id
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'last_pharmacy_id inválido: requiere membresía active o permiso de plataforma';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_last_pharmacy ON public.profiles;
CREATE TRIGGER profiles_validate_last_pharmacy
  BEFORE INSERT OR UPDATE OF last_pharmacy_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_validate_last_pharmacy_preference();

-- -----------------------------------------------------------------------------
-- public_entrypoints: contadores solo vía service_role
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ff_protect_entrypoint_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Clientes autenticados no pueden manipular métricas de acceso
  IF NOT public.ff_is_service_role() THEN
    NEW.access_count := OLD.access_count;
    NEW.last_access_at := OLD.last_access_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS public_entrypoints_protect_access_fields ON public.public_entrypoints;
CREATE TRIGGER public_entrypoints_protect_access_fields
  BEFORE UPDATE ON public.public_entrypoints
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_protect_entrypoint_access_fields();

CREATE OR REPLACE FUNCTION public.ff_record_entrypoint_access(p_public_id text)
RETURNS public.public_entrypoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.public_entrypoints;
BEGIN
  IF NOT public.ff_is_service_role() THEN
    RAISE EXCEPTION 'ff_record_entrypoint_access: solo service_role (Route Handler)';
  END IF;

  IF p_public_id IS NULL OR length(trim(p_public_id)) = 0 THEN
    RAISE EXCEPTION 'ff_record_entrypoint_access: public_id requerido';
  END IF;

  UPDATE public.public_entrypoints pe
  SET
    access_count = pe.access_count + 1,
    last_access_at = pg_catalog.now()
  WHERE pe.public_id = trim(p_public_id)
    AND pe.is_active = true
    AND (pe.expires_at IS NULL OR pe.expires_at > pg_catalog.now())
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'ff_record_entrypoint_access: entrypoint no encontrado o inactivo/expirado';
  END IF;

  -- Defensa en profundidad: destino debe seguir siendo ruta interna
  IF NOT public.ff_is_safe_internal_route(v_row.internal_route) THEN
    RAISE EXCEPTION 'ff_record_entrypoint_access: internal_route insegura';
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.ff_record_entrypoint_access(text) IS
  'Incrementa access_count/last_access_at. Solo service_role (resolución QR vía Route Handler).';

-- -----------------------------------------------------------------------------
-- Privilegios EXECUTE
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.ff_is_platform_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_has_platform_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_is_active_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_has_any_active_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_has_pharmacy_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_pharmacy_has_module(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_can_read_pharmacy(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_is_service_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_write_audit_log(text, uuid, text, text, jsonb, inet, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_record_activity_event(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_validate_last_pharmacy_preference() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_protect_entrypoint_access_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_record_entrypoint_access(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_is_platform_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_has_platform_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_is_active_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_has_any_active_membership() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_has_pharmacy_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_has_module(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_can_read_pharmacy(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_write_audit_log(text, uuid, text, text, jsonb, inet, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ff_record_activity_event(uuid, text, text, text, jsonb) TO authenticated, service_role;

-- Solo service / owner de triggers
GRANT EXECUTE ON FUNCTION public.ff_is_service_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.ff_validate_last_pharmacy_preference() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.ff_protect_entrypoint_access_fields() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.ff_record_entrypoint_access(text) TO service_role;

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS public_entrypoints_protect_access_fields ON public.public_entrypoints;
-- DROP FUNCTION IF EXISTS public.ff_record_entrypoint_access(text);
-- DROP FUNCTION IF EXISTS public.ff_protect_entrypoint_access_fields();
-- DROP TRIGGER IF EXISTS profiles_validate_last_pharmacy ON public.profiles;
-- DROP FUNCTION IF EXISTS public.ff_validate_last_pharmacy_preference();
-- DROP FUNCTION IF EXISTS public.ff_record_activity_event(uuid, text, text, text, jsonb);
-- DROP FUNCTION IF EXISTS public.ff_write_audit_log(text, uuid, text, text, jsonb, inet, text);
-- DROP FUNCTION IF EXISTS public.ff_is_service_role();
-- DROP FUNCTION IF EXISTS public.ff_can_read_pharmacy(uuid);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_has_module(uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_has_pharmacy_permission(uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_has_any_active_membership();
-- DROP FUNCTION IF EXISTS public.ff_is_active_member(uuid);
-- DROP FUNCTION IF EXISTS public.ff_has_platform_permission(text);
-- DROP FUNCTION IF EXISTS public.ff_is_platform_user();
