-- =============================================================================
-- STAGING ONLY — bucket Storage para logos de farmacia (SuperAdmin only)
-- Proyecto: dazfdcjscnpfvhcyjddt
-- NO aplicar en producción desde PR #23.
-- Idempotente: ON CONFLICT + DROP POLICY IF EXISTS.
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

-- Escritura: SOLO SuperAdmin (platform.pharmacies.write).
-- Path obligatorio: {pharmacy_id}/logo.{ext}
DROP POLICY IF EXISTS pharmacy_logos_insert ON storage.objects;
CREATE POLICY pharmacy_logos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );

DROP POLICY IF EXISTS pharmacy_logos_update ON storage.objects;
CREATE POLICY pharmacy_logos_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  )
  WITH CHECK (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );

DROP POLICY IF EXISTS pharmacy_logos_delete ON storage.objects;
CREATE POLICY pharmacy_logos_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pharmacy-logos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );
