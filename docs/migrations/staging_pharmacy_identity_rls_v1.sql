-- =============================================================================
-- STAGING ONLY — identidad de farmacia: escritura solo SuperAdmin
-- Proyecto: dazfdcjscnpfvhcyjddt
-- Idempotente. NO aplicar sin autorización explícita.
--
-- Conserva settings.update / branding.update para ajustes OPERATIVOS:
--   - pharmacy_settings (horario, contactos kiosk, timezone, extra, catalog_mode)
--   - pharmacy_assistant_settings
--   - pharmacy_branding colores / tipografía / welcome (NO logo_url)
--
-- Endurece:
--   - pharmacies.* UPDATE → solo platform.pharmacies.write
--   - pharmacy_branding.logo_url → trigger SA-only
--   - pharmacy_settings.visible_name → trigger SA-only (nombre comercial visible)
--
-- No toca: Storage pharmacy-logos, pedidos, catálogo, stock, PR #21/#22, prod.
-- Ver: staging_pharmacy_identity_rls_NOTES.md
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_enforce_pharmacy_branding_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.logo_url IS NOT NULL
       AND NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
      RAISE EXCEPTION 'ff_identity_forbidden: solo SuperAdmin puede definir logo_url'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url
     AND NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'ff_identity_forbidden: solo SuperAdmin puede modificar logo_url'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_pharmacy_branding_identity ON public.pharmacy_branding;
CREATE TRIGGER trg_pharmacy_branding_identity
  BEFORE INSERT OR UPDATE OF logo_url ON public.pharmacy_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_enforce_pharmacy_branding_identity();

CREATE OR REPLACE FUNCTION public.ff_enforce_pharmacy_settings_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.visible_name IS NOT NULL
       AND NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
      RAISE EXCEPTION 'ff_identity_forbidden: solo SuperAdmin puede definir visible_name'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.visible_name IS DISTINCT FROM OLD.visible_name
     AND NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'ff_identity_forbidden: solo SuperAdmin puede modificar visible_name'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_pharmacy_settings_identity ON public.pharmacy_settings;
CREATE TRIGGER trg_pharmacy_settings_identity
  BEFORE INSERT OR UPDATE OF visible_name ON public.pharmacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_enforce_pharmacy_settings_identity();

-- pharmacies: fila de identidad / estado plataforma → solo SuperAdmin
DROP POLICY IF EXISTS pharmacies_update ON public.pharmacies;
CREATE POLICY pharmacies_update
  ON public.pharmacies
  FOR UPDATE
  TO authenticated
  USING (public.ff_has_platform_permission('platform.pharmacies.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.pharmacies.write'));

REVOKE ALL ON FUNCTION public.ff_enforce_pharmacy_branding_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_enforce_pharmacy_settings_identity() FROM PUBLIC;
-- Triggers SECURITY DEFINER: no GRANT a authenticated (no invocación directa).
