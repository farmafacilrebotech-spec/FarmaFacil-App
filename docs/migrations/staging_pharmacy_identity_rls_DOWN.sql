-- =============================================================================
-- STAGING ONLY — rollback identity RLS v1 (dazfdcjscnpfvhcyjddt)
-- Restaura pharmacies_update con settings.update (estado pre-v1).
-- =============================================================================

DROP TRIGGER IF EXISTS trg_pharmacy_branding_identity ON public.pharmacy_branding;
DROP TRIGGER IF EXISTS trg_pharmacy_settings_identity ON public.pharmacy_settings;
DROP FUNCTION IF EXISTS public.ff_enforce_pharmacy_branding_identity();
DROP FUNCTION IF EXISTS public.ff_enforce_pharmacy_settings_identity();

DROP POLICY IF EXISTS pharmacies_update ON public.pharmacies;
CREATE POLICY pharmacies_update
  ON public.pharmacies
  FOR UPDATE
  TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(id, 'settings.update')
      AND public.ff_pharmacy_is_operable(id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(id, 'settings.update')
      AND public.ff_pharmacy_is_operable(id)
    )
  );
