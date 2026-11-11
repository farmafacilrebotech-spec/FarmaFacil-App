-- =============================================================================
-- STAGING ONLY — bucket Storage para logos de farmacia
-- NO aplicar en producción desde PR #23 sin runbook / aprobación.
-- Ver staging_pharmacy_logos_storage_NOTES.md
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pharmacy-logos',
  'pharmacy-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura pública (cartel PDF / <img>)
DROP POLICY IF EXISTS pharmacy_logos_public_read ON storage.objects;
CREATE POLICY pharmacy_logos_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'pharmacy-logos');

-- Escritura: SuperAdmin write o branding.update de ESA farmacia
DROP POLICY IF EXISTS pharmacy_logos_insert ON storage.objects;
CREATE POLICY pharmacy_logos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_pharmacy_permission(
        ((storage.foldername(name))[1])::uuid,
        'branding.update'
      )
    )
  );

DROP POLICY IF EXISTS pharmacy_logos_update ON storage.objects;
CREATE POLICY pharmacy_logos_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_pharmacy_permission(
        ((storage.foldername(name))[1])::uuid,
        'branding.update'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_pharmacy_permission(
        ((storage.foldername(name))[1])::uuid,
        'branding.update'
      )
    )
  );

DROP POLICY IF EXISTS pharmacy_logos_delete ON storage.objects;
CREATE POLICY pharmacy_logos_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      public.ff_has_platform_permission('platform.pharmacies.write')
      OR public.ff_has_pharmacy_permission(
        ((storage.foldername(name))[1])::uuid,
        'branding.update'
      )
    )
  );

-- Opcional si existe el log de staging local:
-- INSERT INTO public._ff_staging_recovery_log (label, detail)
-- VALUES (
--   'pharmacy_logos_storage_v1',
--   jsonb_build_object('bucket', 'pharmacy-logos')
-- );
