-- =============================================================================
-- 034_kiosk_devices_schema_v1.sql
-- Dispositivos kiosko, códigos one-shot, sesiones, rate-limit e inmutabilidad.
--
-- Seguridad:
--   - Solo hashes de códigos/credenciales en BD.
--   - authenticated NO puede SELECT code_hash / credential_hash (PostgREST).
--   - DEFINER sí lee hashes (bypass RLS + privilegio de owner de función).
--   - pharmacy_id del dispositivo es inmutable tras el alta.
--
-- NO APLICAR automáticamente en producción.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pharmacy_devices
-- -----------------------------------------------------------------------------
CREATE TABLE public.pharmacy_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Tablet kiosko',
  status text NOT NULL DEFAULT 'active',
  paired_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  last_seen_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_devices_status_chk CHECK (
    status = ANY (ARRAY['active', 'revoked'])
  ),
  CONSTRAINT pharmacy_devices_name_not_blank_chk CHECK (
    length(btrim(display_name)) > 0
  ),
  CONSTRAINT pharmacy_devices_revoked_consistency_chk CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.pharmacy_devices IS
  'Tablets/kioskos vinculados a una farmacia. pharmacy_id inmutable tras el alta.';

CREATE INDEX pharmacy_devices_pharmacy_id_status_idx
  ON public.pharmacy_devices (pharmacy_id, status);
CREATE INDEX pharmacy_devices_pharmacy_id_last_seen_idx
  ON public.pharmacy_devices (pharmacy_id, last_seen_at DESC NULLS LAST);

CREATE TRIGGER pharmacy_devices_set_updated_at
  BEFORE UPDATE ON public.pharmacy_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- Inmutabilidad pharmacy_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_devices_forbid_pharmacy_reassign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id THEN
    RAISE EXCEPTION 'pharmacy_devices_pharmacy_id_immutable'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'No se puede reasignar un dispositivo kiosko a otra farmacia. Revoca y vuelve a emparejar.';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_devices_forbid_pharmacy_reassign() IS
  'Impide UPDATE de pharmacy_devices.pharmacy_id. Desvinculación = revoke + nuevo pairing.';

REVOKE ALL ON FUNCTION public.ff_pharmacy_devices_forbid_pharmacy_reassign() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_devices_forbid_pharmacy_reassign()
  TO postgres, service_role;

CREATE TRIGGER pharmacy_devices_forbid_pharmacy_reassign
  BEFORE UPDATE OF pharmacy_id ON public.pharmacy_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_pharmacy_devices_forbid_pharmacy_reassign();

-- -----------------------------------------------------------------------------
-- pharmacy_device_pairing_codes
-- -----------------------------------------------------------------------------
CREATE TABLE public.pharmacy_device_pairing_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_device_id uuid
    REFERENCES public.pharmacy_devices (id) ON DELETE SET NULL,
  created_by uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_device_pairing_codes_hash_not_blank_chk CHECK (
    length(btrim(code_hash)) > 0
  ),
  CONSTRAINT pharmacy_device_pairing_codes_expires_after_created_chk CHECK (
    expires_at > created_at
  )
);

COMMENT ON TABLE public.pharmacy_device_pairing_codes IS
  'Códigos one-shot (hash). TTL típico 10 min. Plaintext nunca se persiste.';

CREATE UNIQUE INDEX pharmacy_device_pairing_codes_code_hash_uidx
  ON public.pharmacy_device_pairing_codes (code_hash);

CREATE INDEX pharmacy_device_pairing_codes_pharmacy_active_idx
  ON public.pharmacy_device_pairing_codes (pharmacy_id, expires_at)
  WHERE consumed_at IS NULL;

-- -----------------------------------------------------------------------------
-- pharmacy_device_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE public.pharmacy_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL
    REFERENCES public.pharmacy_devices (id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  credential_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_device_sessions_hash_not_blank_chk CHECK (
    length(btrim(credential_hash)) > 0
  )
);

COMMENT ON TABLE public.pharmacy_device_sessions IS
  'Sesiones de dispositivo. Cookie HttpOnly Path=/k; BD solo hash del secreto.';

CREATE UNIQUE INDEX pharmacy_device_sessions_credential_hash_uidx
  ON public.pharmacy_device_sessions (credential_hash);

CREATE INDEX pharmacy_device_sessions_device_id_idx
  ON public.pharmacy_device_sessions (device_id);

CREATE INDEX pharmacy_device_sessions_pharmacy_id_idx
  ON public.pharmacy_device_sessions (pharmacy_id);

-- -----------------------------------------------------------------------------
-- Rate-limit durable de emparejamiento (anon / cualquier instancia)
-- -----------------------------------------------------------------------------
CREATE TABLE public.kiosk_pairing_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_pairing_rate_limits_count_chk CHECK (attempt_count >= 0)
);

COMMENT ON TABLE public.kiosk_pairing_rate_limits IS
  'Contadores de intentos fallidos de pairing por huella de cliente (hash). Persistente entre instancias.';

-- Sin RLS de lectura para authenticated: solo DEFINER escribe/lee.
ALTER TABLE public.kiosk_pairing_rate_limits ENABLE ROW LEVEL SECURITY;
-- Sin policies para authenticated/anon → denegado por defecto.
-- service_role bypassa; DEFINER actúa como owner.

-- -----------------------------------------------------------------------------
-- RLS dispositivos / códigos / sesiones
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_device_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacy_devices_select ON public.pharmacy_devices
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.view')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  );

CREATE POLICY pharmacy_devices_insert ON public.pharmacy_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  );

CREATE POLICY pharmacy_devices_update ON public.pharmacy_devices
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  );

CREATE POLICY pharmacy_device_pairing_codes_select ON public.pharmacy_device_pairing_codes
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  );

CREATE POLICY pharmacy_device_pairing_codes_insert ON public.pharmacy_device_pairing_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  );

CREATE POLICY pharmacy_device_sessions_select ON public.pharmacy_device_sessions
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.view')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'kiosk.devices.manage')
  );

-- -----------------------------------------------------------------------------
-- GRANTs de tabla + REVOKE de columnas sensibles
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_devices TO authenticated;
GRANT SELECT, INSERT ON TABLE public.pharmacy_device_pairing_codes TO authenticated;
GRANT SELECT ON TABLE public.pharmacy_device_sessions TO authenticated;

-- Impide que PostgREST (authenticated) lea hashes; DEFINER/owner sigue pudiendo.
REVOKE SELECT (code_hash) ON TABLE public.pharmacy_device_pairing_codes FROM authenticated;
REVOKE SELECT (credential_hash) ON TABLE public.pharmacy_device_sessions FROM authenticated;

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.kiosk_pairing_rate_limits;
-- DROP TRIGGER IF EXISTS pharmacy_devices_forbid_pharmacy_reassign ON public.pharmacy_devices;
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_devices_forbid_pharmacy_reassign();
-- DROP TABLE IF EXISTS public.pharmacy_device_sessions;
-- DROP TABLE IF EXISTS public.pharmacy_device_pairing_codes;
-- DROP TABLE IF EXISTS public.pharmacy_devices;
