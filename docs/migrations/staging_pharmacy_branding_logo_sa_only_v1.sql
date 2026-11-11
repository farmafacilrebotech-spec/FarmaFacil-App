-- =============================================================================
-- STAGING ONLY — endurecer pharmacy_branding: logo_url solo SuperAdmin
-- Proyecto: dazfdcjscnpfvhcyjddt
-- NO aplicar sin autorización explícita (no incluido en storage_v1).
--
-- Hallazgo smoke 2026-11-11: Storage RLS deniega Owner/Admin/Farm/STAFF, pero
-- pharmacy_branding_update aún permite branding.update → pueden mutar logo_url
-- vía PostgREST aunque la app SA-gatee las actions.
-- =============================================================================

-- Opción A (recomendada): UPDATE de branding solo platform.pharmacies.write.
-- Owner/Admin conservan SELECT (branding.view) para consultar logo/colores.
DROP POLICY IF EXISTS pharmacy_branding_update ON public.pharmacy_branding;
CREATE POLICY pharmacy_branding_update
  ON public.pharmacy_branding
  FOR UPDATE
  TO authenticated
  USING (public.ff_has_platform_permission('platform.pharmacies.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.pharmacies.write'));

DROP POLICY IF EXISTS pharmacy_branding_insert ON public.pharmacy_branding;
CREATE POLICY pharmacy_branding_insert
  ON public.pharmacy_branding
  FOR INSERT
  TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.pharmacies.write'));
